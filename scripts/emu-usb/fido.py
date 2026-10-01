# Passkeys against the emulated maki, through the emulator's virtual USB (shot --usb 7878: FIDO
# on 7879): python-fido2's own CTAP2 client, as for the badge (hw-fido-test.py). The emulator's
# --answer says yes on maki's screen. Makes a passkey for a made-up site, signs in with it, and
# deletes it (or with --keep, leaves it: logins.ts needs one).
import hashlib, socket, sys, time
from fido2.hid import CtapHidDevice
from fido2.hid.base import CtapHidConnection, HidDescriptor
from fido2.ctap2 import Ctap2, ClientPin, CredentialManagement
from fido2.ctap2.base import AuthenticatorData

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
PORT = int(ARGS[0]) if ARGS else 7879
KEEP = "--keep" in sys.argv
RP = "maki-test.example"
UP, UV = AuthenticatorData.FLAG.UP, AuthenticatorData.FLAG.UV

class TcpConnection(CtapHidConnection):
    def __init__(self, port):
        self.s = socket.create_connection(("127.0.0.1", port))
        self.s.settimeout(120)
    def read_packet(self):
        data = b""
        while len(data) < 64:
            chunk = self.s.recv(64 - len(data))
            if not chunk:
                raise IOError("the emulator closed the FIDO channel")
            data += chunk
        return data
    def write_packet(self, data):
        self.s.sendall(bytes(data).ljust(64, b"\0")[:64])
    def close(self):
        self.s.close()

def device():
    d = HidDescriptor("emu", 0x1D50, 0x6198, 64, 64, "maki (emulated)", None)
    return CtapHidDevice(d, TcpConnection(PORT))

def flags(ad):
    return ("UP " if ad.flags & UP else "-- ") + ("UV" if ad.flags & UV else "--")

t = time.time()
ctap = Ctap2(device())
print(f"GetInfo in {time.time() - t:.2f} s: uv={ctap.info.options.get('uv')} versions={ctap.info.versions}", flush=True)
cp = ClientPin(ctap)
P = ClientPin.PERMISSION
cdh = hashlib.sha256(b"maki emulated passkey test").digest()

t = time.time()
token = cp.get_uv_token(P.MAKE_CREDENTIAL | P.GET_ASSERTION, RP)
print(f"token by built-in UV in {time.time() - t:.2f} s", flush=True)
t = time.time()
att = ctap.make_credential(cdh, {"id": RP, "name": "maki test"},
                           {"id": b"maki-test-user", "name": "tester", "displayName": "maki tester"},
                           [{"type": "public-key", "alg": -7}], options={"rk": True},
                           pin_uv_param=cp.protocol.authenticate(token, cdh),
                           pin_uv_protocol=cp.protocol.VERSION)
print(f"made a passkey in {time.time() - t:.2f} s: {flags(att.auth_data)} (want UP UV)", flush=True)
cred_id = att.auth_data.credential_data.credential_id

token = cp.get_uv_token(P.GET_ASSERTION, RP)
t = time.time()
a = ctap.get_assertion(RP, cdh, pin_uv_param=cp.protocol.authenticate(token, cdh),
                       pin_uv_protocol=cp.protocol.VERSION)
print(f"signed in in {time.time() - t:.2f} s: {flags(a.auth_data)} (want UP UV)", flush=True)
a.verify(cdh, att.auth_data.credential_data.public_key) if hasattr(a, "verify") else None

# without a press: up=false (a site checking a passkey is there) answers at once, no question
t = time.time()
a = ctap.get_assertion(RP, cdh, options={"up": False})
print(f"silent check in {time.time() - t:.2f} s: {flags(a.auth_data)} (want -- --)", flush=True)

if KEEP:
    print("kept the test passkey", flush=True)
    sys.exit(0)
token = cp.get_uv_token(P.CREDENTIAL_MGMT)
cm = CredentialManagement(ctap, cp.protocol, token)
cm.delete_cred({"type": "public-key", "id": cred_id})
print("deleted the test passkey", flush=True)

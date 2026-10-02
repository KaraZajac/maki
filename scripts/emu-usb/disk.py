# A disk unlocked with maki, as systemd-cryptsetup does it at boot: through the emulator's virtual
# USB (FIDO on 7879, maki's buttons on the control port 7881), with python-fido2 speaking CTAP the
# way libfido2 does. Enrolls a credential with hmac-secret (systemd-cryptenroll's part), then locks
# maki and asks for the disk's secret while it's locked: maki must answer CTAPHID_INIT, keep the
# computer waiting until its PIN is entered (here, from another thread, after a while), then ask
# its owner (the emulator's --answer says yes) and give the same secret as at enrollment.
#
#   fido-venv/bin/python disk.py [FIDO_PORT] [CONTROL_PORT]
import hashlib, os, socket, sys, threading, time
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open("fido.py").read().split("t = time.time()")[0])  # the TCP device and helpers
from fido2.ctap import CtapError
from fido2.ctap2 import Ctap2, ClientPin

# every keepalive packet maki sends (python-fido2 tells only of a change in their status)
KEEPALIVES = [0]
_read = TcpConnection.read_packet
def _counting(self):
    p = _read(self)
    if p[4] == 0xBB:
        KEEPALIVES[0] += 1
    return p
TcpConnection.read_packet = _counting

CONTROL = int(ARGS[1]) if len(ARGS) > 1 else 7881
RP = "io.systemd.cryptsetup"
SALT = hashlib.sha256(b"maki disk test salt").digest()
# how long maki waits, locked, before the PIN goes in: the computer must be kept waiting meanwhile
LOCKED_FOR = 15

def press(*keys):
    """maki's buttons through the emulator's control port: 3 left, 4 right, 5 centre, 3+4 the menu."""
    with socket.create_connection(("127.0.0.1", CONTROL)) as c:
        for k in keys:
            c.sendall(f"press {k}\n".encode())
            time.sleep(1.5)

def lock():
    press("3+4", "5")  # maki's menu, its first item: Lock

def enter_pin():
    # a demo build's PIN pad starts each digit at 0: 000000, then left to "done"
    press(*(["5"] * 6), "3", "5")

def hmac_secret(ctap, cred_id, up=True):
    """The salt's output, as libfido2 asks for it: the salt encrypted to a shared secret from the
    PIN protocol's key agreement, authenticated, and the output decrypted with it."""
    cp = ClientPin(ctap)
    key_agreement, shared = cp._get_shared_secret()
    salt_enc = cp.protocol.encrypt(shared, SALT)
    salt_auth = cp.protocol.authenticate(shared, salt_enc)
    ext = {"hmac-secret": {1: key_agreement, 2: salt_enc, 3: salt_auth, 4: cp.protocol.VERSION}}
    cdh = hashlib.sha256(b"maki disk test assertion").digest()
    a = ctap.get_assertion(RP, cdh, allow_list=[{"type": "public-key", "id": cred_id}],
                           extensions=ext, options={"up": up})
    out = a.auth_data.extensions["hmac-secret"]
    return cp.protocol.decrypt(shared, out), a

# enrollment, maki unlocked: a credential that isn't resident (its ID goes in the LUKS header),
# with hmac-secret, verified by maki's own PIN (built-in UV)
enrolling = device()
ctap = Ctap2(enrolling)
print(f"options: uv={ctap.info.options.get('uv')} clientPin={ctap.info.options.get('clientPin')} "
      f"extensions={ctap.info.extensions}", flush=True)
cp = ClientPin(ctap)
cdh = hashlib.sha256(b"maki disk test enrollment").digest()
token = cp.get_uv_token(ClientPin.PERMISSION.MAKE_CREDENTIAL, RP)
# while maki asks its owner, it keeps the computer waiting: a keepalive a tenth of a second, not
# as fast as it can (USB's FIDO receive timeout once fired at once, and the wait spun)
before = KEEPALIVES[0]
t = time.time()
att = ctap.make_credential(cdh, {"id": RP, "name": "disk"},
                           {"id": b"maki-disk-test", "name": "disk", "displayName": "disk"},
                           [{"type": "public-key", "alg": -7}], extensions={"hmac-secret": True},
                           options={"rk": False}, pin_uv_param=cp.protocol.authenticate(token, cdh),
                           pin_uv_protocol=cp.protocol.VERSION)
asked = time.time() - t
count = KEEPALIVES[0] - before
rate = count / asked if asked else 0
print(f"asked for {asked:.1f} s: {count} keepalives, {rate:.1f} a second (want about 10)", flush=True)
spins = rate > 40
assert att.auth_data.extensions.get("hmac-secret") is True, att.auth_data.extensions
cred_id = att.auth_data.credential_data.credential_id
enrolled, _ = hmac_secret(ctap, cred_id)
print(f"enrolled: a {len(cred_id)}-byte credential, its secret {enrolled.hex()[:16]}...", flush=True)

# boot: maki locked, then asked (the emulator's FIDO port takes one connection at a time)
enrolling.close()
lock()
time.sleep(5)
print("maki locked: asking it for the disk's secret", flush=True)
threading.Timer(LOCKED_FOR, enter_pin).start()
held_from = KEEPALIVES[0]
t = time.time()
dev = device()                      # CTAPHID_INIT: answered while locked, or this fails
print(f"INIT answered while locked in {time.time() - t:.2f} s", flush=True)
ctap = Ctap2(dev)                   # GetInfo: held until the PIN, with keepalives
waited = time.time() - t
held = KEEPALIVES[0] - held_from
print(f"GetInfo answered after {waited:.1f} s (want about {LOCKED_FOR} s and more: held for the PIN), "
      f"{held} keepalives meanwhile, {held / waited:.1f} a second", flush=True)
secret, a = hmac_secret(ctap, cred_id)
print(f"unlocked secret {secret.hex()[:16]}... flags {flags(a.auth_data)}", flush=True)
ok = secret == enrolled and waited >= LOCKED_FOR - 1 and not spins and held >= waited
print("disk test:", "PASS: the same secret, asked while maki was locked" if ok else "FAIL", flush=True)
sys.exit(0 if ok else 1)

# The passkey vault-import.ts imported, used through FIDO as a site uses one: through the
# emulator's virtual USB (FIDO on 7879), with python-fido2. maki must find it by its site with no
# list of credentials (a passkey sign-in), and by its ID in a site's list among IDs it doesn't
# have; sign with the key it was given (each signature checked with the passkey's public key,
# which the script that made it knows); count with its one signature counter, going up; answer a
# check without a press; and report the same public key in its credential management. The
# emulator's --answer says yes on maki's screen.
#
#   fido-venv/bin/python vault-import.py FIDO_PORT RP_ID CRED_ID_HEX USER_HANDLE_HEX X_HEX Y_HEX
import hashlib, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open("fido.py").read().split("t = time.time()")[0])  # the TCP device and helpers
from fido2.cose import ES256
from fido2.ctap2 import CredentialManagement

if len(ARGS) != 6:
    sys.exit(__doc__ or "vault-import.py FIDO_PORT RP_ID CRED_ID_HEX USER_HANDLE_HEX X_HEX Y_HEX")
SITE = ARGS[1]
CRED, HANDLE, X, Y = (bytes.fromhex(a) for a in ARGS[2:6])
KEY = ES256({1: 2, 3: -7, -1: 1, -2: X, -3: Y})

failed = 0
def check(what, ok, got=""):
    global failed
    print(("PASS: " if ok else "FAIL: ") + what + ("" if ok else f": {got}"), flush=True)
    failed += 0 if ok else 1

def signed(a, cdh):
    """Whether the assertion's signature is the passkey's, over what the site would check."""
    try:
        a.verify(cdh, KEY)
        return True
    except Exception as e:
        print(f"  the signature doesn't check out: {e!r}", flush=True)
        return False

ctap = Ctap2(device())
cp = ClientPin(ctap)
P = ClientPin.PERMISSION
counters = []

# a passkey sign-in: no list, maki finds it by its site; verified by maki's own PIN (built-in UV)
cdh = hashlib.sha256(b"maki import test: a passkey sign-in").digest()
token = cp.get_uv_token(P.GET_ASSERTION, SITE)
a = ctap.get_assertion(SITE, cdh, pin_uv_param=cp.protocol.authenticate(token, cdh),
                       pin_uv_protocol=cp.protocol.VERSION)
check("found by its site, with no list of credentials", a.credential["id"] == CRED, a.credential)
check("for the user it was given", a.user is not None and a.user.get("id") == HANDLE, a.user)
check("signed with the key it was given", signed(a, cdh))
check("a press and maki's PIN (UP UV)", flags(a.auth_data) == "UP UV", flags(a.auth_data))
counters.append(a.auth_data.counter)

# by its ID, in a site's list, after IDs maki doesn't have (one as long as an ID maki encrypts)
cdh = hashlib.sha256(b"maki import test: in a list").digest()
listed = [{"type": "public-key", "id": os.urandom(16)}, {"type": "public-key", "id": os.urandom(241)},
          {"type": "public-key", "id": CRED}]
a = ctap.get_assertion(SITE, cdh, allow_list=listed)
check("found by its ID in a site's list", a.credential["id"] == CRED, a.credential)
check("signed with the key it was given", signed(a, cdh))
counters.append(a.auth_data.counter)

# a site checking it's there: no press, and still its signature
cdh = hashlib.sha256(b"maki import test: silent").digest()
a = ctap.get_assertion(SITE, cdh, allow_list=[{"type": "public-key", "id": CRED}], options={"up": False})
check("a check without a press (-- --)", flags(a.auth_data) == "-- --", flags(a.auth_data))
check("signed with the key it was given", signed(a, cdh))
counters.append(a.auth_data.counter)
check(f"maki's signature counter goes up ({counters})", counters == sorted(set(counters)) and counters[0] > 0, counters)

# maki's credential management lists it: its user, and the public key OpenSK works out from the
# key it was given
token = cp.get_uv_token(P.CREDENTIAL_MGMT)
cm = CredentialManagement(ctap, cp.protocol, token)
R = CredentialManagement.RESULT
creds = cm.enumerate_creds(hashlib.sha256(SITE.encode()).digest())
mine = [c for c in creds if c[R.CREDENTIAL_ID]["id"] == CRED]
check("listed by credential management", len(mine) == 1, creds)
if mine:
    user, public = mine[0][R.USER], mine[0][R.PUBLIC_KEY]
    check("with its user's name", user.get("id") == HANDLE and user.get("name") == "alice", user)
    check("and its public key", public.get(-2) == X and public.get(-3) == Y, public)

print("vault-import.py:", "all passed" if not failed else f"{failed} failed", flush=True)
sys.exit(1 if failed else 0)

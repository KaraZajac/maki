# The computer cancels while maki asks: maki must take its question back, and the computer hears
# "cancelled" (KEEPALIVE_CANCEL). Through the emulator's virtual USB, as fido.py.
import hashlib, sys, threading, time
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open("fido.py").read().split("t = time.time()")[0])  # the TCP device and helpers
from fido2.ctap import CtapError
from fido2.ctap2 import Ctap2, ClientPin

ctap = Ctap2(device())
cp = ClientPin(ctap)
cdh = hashlib.sha256(b"maki cancel test").digest()
token = cp.get_uv_token(ClientPin.PERMISSION.MAKE_CREDENTIAL, RP)
cancel = threading.Event()
waiting = []
def on_keepalive(status):
    # the first "waiting for a press": the browser's dialog dismissed, say
    if status == 2 and not cancel.is_set():
        waiting.append(time.time())
        cancel.set()
t = time.time()
try:
    ctap.make_credential(cdh, {"id": RP, "name": "maki test"},
                         {"id": b"maki-cancel-user", "name": "cancelled", "displayName": "cancelled"},
                         [{"type": "public-key", "alg": -7}], options={"rk": True},
                         pin_uv_param=cp.protocol.authenticate(token, cdh),
                         pin_uv_protocol=cp.protocol.VERSION, event=cancel, on_keepalive=on_keepalive)
    print("made a passkey: the cancel was missed (want KEEPALIVE_CANCEL)")
except CtapError as e:
    print(f"after {time.time() - t:.1f} s: {e} (want KEEPALIVE_CANCEL)")

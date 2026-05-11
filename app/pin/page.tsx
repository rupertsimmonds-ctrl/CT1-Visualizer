export const metadata = { title: "City Tower 1 — broker access" };

export default function PinPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#210302",
        color: "#F4F2EE",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <main style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div
          style={{
            width: 60,
            height: 60,
            margin: "0 auto 22px",
            transform: "rotate(45deg)",
            border: "1px solid #D7A86F",
            background: "#F4F2EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-hidden
        >
          <span
            style={{
              transform: "rotate(-45deg)",
              color: "#210302",
              fontFamily: "Georgia, serif",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.04em",
            }}
          >
            bh
          </span>
        </div>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#D7A86F",
            margin: "0 0 6px",
          }}
        >
          City Tower 1
        </p>
        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 24,
            margin: "0 0 24px",
            color: "#F4F2EE",
            fontWeight: 400,
          }}
        >
          Broker access
        </h1>
        <form
          id="pin-form"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            id="pin-input"
            name="pin"
            type="password"
            autoComplete="off"
            autoFocus
            inputMode="numeric"
            placeholder="Enter PIN"
            required
            style={{
              background: "rgba(244,242,238,0.06)",
              border: "1px solid rgba(215,168,111,0.3)",
              color: "#F4F2EE",
              fontSize: 18,
              letterSpacing: "0.4em",
              textAlign: "center",
              padding: "14px 16px",
              borderRadius: 0,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              background: "#D7A86F",
              color: "#210302",
              border: 0,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              padding: "14px 16px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Continue
          </button>
          <div
            id="pin-msg"
            style={{
              minHeight: 18,
              fontSize: 12,
              color: "#FF787A",
              marginTop: 4,
            }}
          ></div>
        </form>
      </main>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              var f = document.getElementById('pin-form');
              var i = document.getElementById('pin-input');
              var m = document.getElementById('pin-msg');
              f.addEventListener('submit', async function(e){
                e.preventDefault();
                m.textContent = '';
                try {
                  var r = await fetch('/api/pin', {
                    method: 'POST',
                    headers: {'content-type':'application/json'},
                    body: JSON.stringify({ pin: i.value })
                  });
                  var body = await r.json().catch(function(){return null;});
                  if (r.ok && body && body.ok) {
                    location.replace('/');
                    return;
                  }
                  m.textContent = (body && body.message) || 'Wrong PIN';
                  i.select();
                } catch (err) {
                  m.textContent = 'Network error — try again';
                }
              });
            })();
          `,
        }}
      />
    </div>
  );
}

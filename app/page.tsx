export default function Page() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
      <p>Loading City Tower 1…</p>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            var ua = navigator.userAgent || '';
            var isMobile = /iPhone|iPod|Android.*Mobile|Mobile.*Firefox|IEMobile|BlackBerry|webOS/i.test(ua);
            location.replace(isMobile ? '/mobile.html' : '/desktop.html');
          `,
        }}
      />
      <noscript>
        <p>
          <a href="/desktop.html">Open desktop version</a> ·{" "}
          <a href="/mobile.html">Open mobile version</a>
        </p>
      </noscript>
    </main>
  );
}

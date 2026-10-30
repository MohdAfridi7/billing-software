// v1.10.83 (#117) - the signature and company stamp on an invoice, in the
// layout chosen under Settings -> Business Profile (profile.signLayout):
//   'side'  - side by side (the default, as before)
//   'stack' - the stamp above the signature
//   'over'  - the stamp on the signature, as a rubber stamp is put on paper
// Shared by every invoice design so they all follow the setting.
export const SIGN_LAYOUTS = [
  { value: 'side', label: 'Side by side' },
  { value: 'stack', label: 'Stamp above the signature' },
  { value: 'over', label: 'Stamp on the signature' },
];

export default function SignatureImages({ sigImg, stampImg, sigHeight = 60, stampHeight = 70, layout = 'side', align = 'center', gap = 8, sigMaxWidth = 180, stampMaxWidth = 120 }) {
  if (!sigImg && !stampImg) return null;
  const justify = align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center';
  const img = (src, alt, h, w, extra = {}) => (
    <img src={src} alt={alt} style={{ maxHeight: `${h}px`, maxWidth: `${w}px`, objectFit: 'contain', display: 'block', ...extra }} />
  );
  const stamp = stampImg && img(stampImg, 'Stamp', stampHeight, stampMaxWidth);
  const sign = sigImg && img(sigImg, 'Signature', sigHeight, sigMaxWidth);

  if (layout === 'stack' || (layout === 'over' && !(sigImg && stampImg))) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: justify, gap: Math.round(gap / 2), marginBottom: '0.4rem' }}>
        {stamp}{sign}
      </div>
    );
  }
  if (layout === 'over') {
    // The stamp sits across the right half of the signature, a little
    // transparent so the signature still reads through it.
    return (
      <div style={{ display: 'flex', justifyContent: justify, marginBottom: '0.4rem' }}>
        <div style={{ position: 'relative', display: 'inline-block', paddingRight: Math.round(stampMaxWidth * 0.35) }}>
          {sign}
          {img(stampImg, 'Stamp', stampHeight, stampMaxWidth, { position: 'absolute', right: 0, bottom: 0, opacity: 0.85 })}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: justify, gap, marginBottom: '0.4rem' }}>
      {stamp}{sign}
    </div>
  );
}

type ProductPhotoCreditProps = {
  attribution?: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
  className?: string;
};

export default function ProductPhotoCredit({
  attribution,
  sourceUrl,
  license,
  licenseUrl,
  className = '',
}: ProductPhotoCreditProps) {
  if (!attribution && !sourceUrl && !license) return null;
  const generated = attribution === 'AI-generated studio product photograph';

  return (
    <p className={`mt-2 text-[10px] leading-4 text-ink/45 ${className}`}>
      {generated ? 'AI-generated illustrative product photo' : `Photo ${attribution ? `by ${attribution}` : 'source'}`}
      {license ? <> · {licenseUrl ? <a href={licenseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-moss underline underline-offset-2">{license}</a> : license}</> : ''}
      {sourceUrl ? (
        <>
          {' · '}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-moss underline underline-offset-2">
            View source
          </a>
        </>
      ) : null}
    </p>
  );
}

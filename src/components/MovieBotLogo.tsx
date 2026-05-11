import type { SVGProps } from "react";

function MovieBotLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width="200"
      height="200"
      aria-label="MovieBot Logo"
      {...props}
    >
      <rect width="200" height="200" rx="42" fill="#101418" />
      <rect x="34" y="54" width="132" height="94" rx="18" fill="#f7f7f2" />
      <path
        d="M34 72h132M54 54l-20 18M88 54 68 72M122 54l-20 18M156 54l-20 18"
        stroke="#101418"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect x="48" y="88" width="104" height="46" rx="10" fill="#101418" />
      <circle cx="76" cy="111" r="10" fill="#f7f7f2" />
      <circle cx="124" cy="111" r="10" fill="#f7f7f2" />
      <rect x="72" y="138" width="56" height="6" rx="3" fill="#101418" />
      <text
        x="100"
        y="180"
        fill="#f7f7f2"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fontWeight="700"
        textAnchor="middle"
      >
        MovieBot
      </text>
    </svg>
  );
}

export default MovieBotLogo;

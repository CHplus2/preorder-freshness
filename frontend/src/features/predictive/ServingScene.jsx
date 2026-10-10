export default function ServingScene({ sold, playing }) {
  return (
    <svg
      className={`fc-serving-scene ${playing ? "is-serving" : ""}`}
      viewBox="0 0 640 390"
      role="img"
      aria-label={`Illustrative restaurant counter: ${sold} fictional portions served, ${20 - sold} remaining. Customers are decorative, not recorded orders.`}
    >
      <rect width="640" height="390" rx="24" fill="#ece9d4" />
      <ellipse cx="325" cy="335" rx="270" ry="35" fill="#b2b698" />
      <path d="m52 280 320-95 219 95-319 93Z" fill="#d6bd91" />
      <path
        d="M92 114h375v179H92Z"
        fill="#f8e5bb"
        stroke="#725941"
        strokeWidth="4"
      />
      <path
        d="m467 114 77-32v179l-77 32Z"
        fill="#c0a072"
        stroke="#725941"
        strokeWidth="4"
      />
      <path
        d="m67 113 113-68h316l65 68Z"
        fill="#bb7253"
        stroke="#725941"
        strokeWidth="4"
      />
      <path d="M90 118h379v35H90Z" fill="#f4c986" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${91 + i * 63} 118h30v35h-30Z`} fill="#b55b48" />
      ))}
      <rect
        x="168"
        y="60"
        width="255"
        height="43"
        rx="10"
        fill="#426b58"
        stroke="#e8d2a8"
        strokeWidth="4"
      />
      <text
        x="296"
        y="88"
        textAnchor="middle"
        fill="#fff8e5"
        fontSize="21"
        fontWeight="700"
      >
        FRESHCAST KITCHEN
      </text>
      <rect x="157" y="165" width="244" height="78" rx="12" fill="#4b6c59" />
      <g transform="translate(310 163)">
        <path d="M-26 73V49q26-24 52 0v24" fill="#91ab7b" />
        <circle cy="26" r="19" fill="#e5b88b" />
        <path
          d="M-22 19V8q-17-13-2-22 9-12 22-3 17-14 29 0 15 11-5 25v11Z"
          fill="#fff8e5"
          stroke="#725941"
          strokeWidth="2"
        />
        <circle cx="-7" cy="28" r="2" fill="#426b58" />
        <circle cx="7" cy="28" r="2" fill="#426b58" />
        <path
          d="M-5 36q5 5 10 0"
          fill="none"
          stroke="#725941"
          strokeWidth="2"
        />
      </g>
      <path
        d="M110 231h346v26H110Z"
        fill="#fdf5dd"
        stroke="#725941"
        strokeWidth="3"
      />
      <path
        d="M110 257h346v46H110Z"
        fill="#bd8c5c"
        stroke="#725941"
        strokeWidth="3"
      />
      {Array.from({ length: 20 }, (_, i) => (
        <g
          key={i}
          transform={`translate(${136 + (i % 10) * 29} ${265 + Math.floor(i / 10) * 20})`}
        >
          <ellipse
            rx="10"
            ry="6"
            fill={i < sold ? "#d6c39e" : "#fff8e5"}
            stroke="#725941"
            strokeWidth="1"
          />
          {i >= sold && <path d="M-5 0q5-8 10 0-5 5-10 0" fill="#b9744e" />}
        </g>
      ))}
      <g fill="#d7a26a" stroke="#725941" strokeWidth="2">
        <ellipse cx="124" cy="180" rx="17" ry="26" />
        <ellipse cx="433" cy="180" rx="17" ry="26" />
      </g>
      <path d="M124 153v-17m309 17v-17" stroke="#725941" strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          className={`fc-serving-person person-${i}`}
          transform={`translate(${180 + i * 110} 315)`}
        >
          <circle
            cy="-14"
            r="12"
            fill="#e5b88b"
            stroke="#725941"
            strokeWidth="2"
          />
          <path d="M-13-22q10-18 26 0" fill={i === 1 ? "#9c6347" : "#725941"} />
          <path
            d="M-18 24V7q18-19 36 0v17Z"
            fill={["#749a9e", "#c88869", "#7d9573"][i]}
            stroke="#725941"
            strokeWidth="2"
          />
          <path d="M-8 24v16m16-16v16" stroke="#725941" strokeWidth="5" />
        </g>
      ))}
      <text x="320" y="380" textAnchor="middle" fill="#426b58" fontSize="12">
        Fictional shift · plates show preset portion totals
      </text>
    </svg>
  );
}

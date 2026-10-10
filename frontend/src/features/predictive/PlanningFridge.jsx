import { useId, useState } from "react";
import { DoorOpen, DoorClosed, Snowflake } from "lucide-react";
import "./planningFridge.css";
function FridgeDoor() {
  return (
    <svg
      viewBox="0 0 600 650"
      aria-hidden="true"
      className="fc-fridge-door-art"
    >
      <defs>
        <linearGradient id="fc-fridge-paint" x2="1" y2="1">
          <stop stopColor="#dce9cf" />
          <stop offset="1" stopColor="#a7bf98" />
        </linearGradient>
      </defs>
      <rect
        x="32"
        y="20"
        width="536"
        height="590"
        rx="38"
        fill="url(#fc-fridge-paint)"
        stroke="#597554"
        strokeWidth="7"
      />
      <path d="M40 205h520" stroke="#597554" strokeWidth="6" />
      <rect
        x="74"
        y="112"
        width="15"
        height="62"
        rx="7"
        fill="#fff9eb"
        stroke="#597554"
        strokeWidth="3"
      />
      <rect
        x="74"
        y="258"
        width="15"
        height="111"
        rx="7"
        fill="#fff9eb"
        stroke="#597554"
        strokeWidth="3"
      />
      <path d="M80 612v20m440-20v20" stroke="#597554" strokeWidth="15" />
      <g transform="translate(205 290) rotate(-5)">
        <rect
          width="220"
          height="170"
          rx="5"
          fill="#fffcf4"
          stroke="#c7b18c"
          strokeWidth="3"
        />
        <circle cx="112" cy="5" r="12" fill="#c38c64" />
        <path
          d="M35 48h150m-150 27h120m-120 27h140m-140 27h90"
          stroke="#a4b594"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M460 84c-32-31-72 6-34 31l34 24 34-24c38-25-2-62-34-31Z"
        fill="#c98f76"
      />
      <path d="M489 491c-41-32-68 9-30 30 33 18 75-8 30-30Z" fill="#769568" />
      <path d="m455 527 27-18m-15 9v-14" stroke="#456744" strokeWidth="3" />
    </svg>
  );
}
export function KitchenKeeper() {
  return (
    <svg viewBox="0 0 100 100" className="fc-kitchen-keeper" aria-hidden="true">
      <ellipse cx="50" cy="91" rx="35" ry="6" fill="#304b3c18" />
      <path
        d="M20 88V68q30-25 60 0v20Z"
        fill="#79936e"
        stroke="#466651"
        strokeWidth="2"
      />
      <path
        d="m36 60-3 28h35l-4-28"
        fill="#fff9eb"
        stroke="#466651"
        strokeWidth="2"
      />
      <ellipse
        cx="50"
        cy="43"
        rx="25"
        ry="23"
        fill="#e8bd8d"
        stroke="#785a3d"
        strokeWidth="2"
      />
      <path
        d="M25 38q-5-27 10-20 12-24 22-5 20-13 20 21l-7 7Z"
        fill="#fff9eb"
        stroke="#785a3d"
        strokeWidth="2"
      />
      <path d="M26 36h47" stroke="#a3b792" strokeWidth="4" />
      <circle cx="41" cy="46" r="2.5" fill="#466651" />
      <circle cx="59" cy="46" r="2.5" fill="#466651" />
      <path d="M44 55q6 7 12 0" stroke="#785a3d" strokeWidth="2" fill="none" />
      <ellipse cx="33" cy="53" rx="5" ry="3" fill="#c98f7680" />
      <ellipse cx="67" cy="53" rx="5" ry="3" fill="#c98f7680" />
    </svg>
  );
}
export default function PlanningFridge({
  children,
  count,
  initialOpen = true,
}) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  return (
    <section
      className={`fc-fridge ${open ? "is-open" : "is-closed"}`}
      aria-label="Illustrated planning fridge"
    >
      <div className="fc-fridge-heading">
        <div>
          <span className="pantry-kicker">
            THE LITTLE KITCHEN · STOCK INSPECTION
          </span>
          <h4>Your planning fridge</h4>
          <p>
            {count} ingredient{count === 1 ? "" : "s"} in this view · simulated
            stock
          </p>
        </div>
        <button
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <DoorClosed size={18} aria-hidden="true" />
          ) : (
            <DoorOpen size={18} aria-hidden="true" />
          )}
          {open ? "Close planning fridge" : "Open planning fridge"}
        </button>
      </div>
      <div className="fc-fridge-cabinet">
        <div className="fc-fridge-inside" id={id} hidden={!open}>
          <div className="fc-fridge-light">
            <Snowflake size={18} aria-hidden="true" />
            <span>Pick an ingredient to inspect its story</span>
          </div>
          {children}
        </div>
        {!open && (
          <div className="fc-fridge-door">
            <FridgeDoor />
            <button
              onClick={() => setOpen(true)}
              aria-controls={id}
              aria-expanded={false}
            >
              Open and explore <DoorOpen size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <p className="fc-fridge-caption">
        Visual planning cabinet · shelf positions and temperature are not
        storage instructions.
      </p>
    </section>
  );
}

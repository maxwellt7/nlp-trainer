interface Props {
  name: string;
  definition: string;
  tipOff?: string;
  examples?: string[];
  number?: number;
}

export default function PatternCard({ name, definition, tipOff, examples, number }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-start gap-3">
        {number != null && (
          <span className="bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            {number}
          </span>
        )}
        <div>
          <h3 className="font-semibold text-white">{name}</h3>
          <p className="text-sm text-gray-300 mt-1">{definition}</p>
          {tipOff && (
            <p className="text-xs text-indigo-400 mt-2">Tip-off: {tipOff}</p>
          )}
          {examples && examples.length > 0 && (
            <div className="mt-3 space-y-1">
              {examples.slice(0, 5).map((ex, i) => (
                <p key={i} className="text-sm text-gray-400 italic">&ldquo;{ex}&rdquo;</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import PatternCard from '../components/PatternCard';

const CATEGORIES = [
  { id: 'milton-model', label: 'Milton Model' },
  { id: 'meta-programs', label: 'Meta Programs' },
  { id: 'presuppositions', label: 'Presuppositions' },
  { id: 'prime-directives', label: 'Prime Directives' },
  { id: 'quantum-linguistics', label: 'Quantum Linguistics' },
  { id: 'personal-breakthrough', label: 'Personal Breakthrough' },
];

export default function Reference() {
  const [data, setData] = useState<any>(null);
  const [category, setCategory] = useState('milton-model');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getReference().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="p-8 text-gray-400">Loading reference data...</div>;

  const getItems = (): any[] => {
    switch (category) {
      case 'milton-model':
        return (data.miltonModel?.patterns || []).map((p: any) => ({
          name: p.name, definition: p.definition, tipOff: p.tipOff, examples: p.examples, number: p.number
        }));
      case 'meta-programs':
        return (data.metaPrograms?.filters || []).map((f: any) => ({
          name: f.name,
          definition: f.elicitationQuestion,
          tipOff: f.options?.map((o: any) => o.label).join(', '),
          examples: Object.entries(f.linguisticMarkers || {}).map(([k, v]) => `${k}: ${v}`),
          number: f.number
        }));
      case 'presuppositions':
        return [
          ...(data.presuppositions?.nlpPresuppositions || []).map((p: any) => ({
            name: `${p.mnemonicLetter} \u2014 ${p.keyword}`, definition: p.text, number: p.number
          })),
          ...(data.presuppositions?.linguisticPresuppositions || []).map((p: any) => ({
            name: p.name, definition: p.definition, tipOff: p.tipOff, examples: p.examples, number: p.number
          })),
        ];
      case 'prime-directives':
        return (data.primeDirectives?.primeDirectives || []).map((d: any) => ({
          name: d.text, definition: d.details || '', number: d.number
        }));
      case 'quantum-linguistics': {
        const ql = data.quantumLinguistics || {};
        const items: any[] = [];
        if (ql.embeddedCommands) items.push({ name: 'Embedded Commands', definition: ql.embeddedCommands.definition, examples: ql.embeddedCommands.steps });
        if (ql.cartesianCoordinates) items.push({
          name: 'Cartesian Coordinates',
          definition: 'Four perspectives for exploring decisions',
          examples: Object.entries(ql.cartesianCoordinates).map(([k, v]: [string, any]) => `${k}: ${v.question}`)
        });
        if (ql.symbolicLogic) items.push({ name: 'Symbolic Logic', definition: 'Logical operators used in NLP', examples: ql.symbolicLogic });
        if (ql.inductiveDeductive) {
          items.push({ name: 'Deduction', definition: ql.inductiveDeductive.deduction.definition, examples: [ql.inductiveDeductive.deduction.example] });
          items.push({ name: 'Induction', definition: ql.inductiveDeductive.induction.definition, examples: [ql.inductiveDeductive.induction.example] });
        }
        return items;
      }
      case 'personal-breakthrough': {
        const pb = data.personalBreakthrough || {};
        const pbItems: any[] = [];
        if (pb.detailedPersonalHistory) pbItems.push(...pb.detailedPersonalHistory.map((q: any) => ({
          name: `Question ${q.number}`, definition: q.question, examples: q.purpose ? [q.purpose] : [], number: q.number
        })));
        if (pb.interventionSteps) pbItems.push(...pb.interventionSteps.map((s: any) => ({
          name: s.title, definition: s.description, number: s.number
        })));
        return pbItems;
      }
      default:
        return [];
    }
  };

  let items = getItems();
  if (search.trim()) {
    const q = search.toLowerCase();
    items = items.filter((item: any) =>
      item.name?.toLowerCase().includes(q) ||
      item.definition?.toLowerCase().includes(q) ||
      item.examples?.some((e: string) => e.toLowerCase().includes(q))
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Reference</h1>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search patterns, definitions, examples..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-6"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              category === cat.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-gray-500 text-sm">No results found.</div>
        ) : (
          items.map((item: any, i: number) => (
            <PatternCard key={i} {...item} />
          ))
        )}
      </div>
    </div>
  );
}

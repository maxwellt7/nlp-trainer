import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import modulesData from '../../../server/data/modules.json';

interface Lesson {
  id: string;
  title: string;
  description: string;
  dataFile: string;
  contentKeys: string[];
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export default function Learn() {
  const navigate = useNavigate();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const modules = modulesData.modules as Module[];

  return (
    <Screen>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>
        Learn
      </h1>
      <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
        Explore NLP techniques, mind-body healing, and belief-change practices.
      </div>

      {modules.map((module, idx) => (
        <div key={module.id} style={{ marginBottom: 16 }}>
          <Card>
            <div 
              onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--rd-accent)',
                  color: '#06121c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 15,
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontFamily: 'var(--font-display)', 
                    fontSize: 18, 
                    color: 'var(--rd-ink-soft)',
                    marginBottom: 4,
                  }}>
                    {module.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5 }}>
                    {module.description}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    color: 'var(--rd-muted-2)', 
                    marginTop: 6,
                  }}>
                    {module.lessons.length} lesson{module.lessons.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div style={{ 
                  color: 'var(--rd-muted)', 
                  fontSize: 18,
                  flexShrink: 0,
                }}>
                  {expandedModule === module.id ? '▲' : '▼'}
                </div>
              </div>
            </div>

            {expandedModule === module.id && (
              <div style={{ 
                marginTop: 16, 
                paddingTop: 16, 
                borderTop: '1px solid var(--rd-border)',
              }}>
                {module.lessons.map((lesson) => (
                  <div 
                    key={lesson.id}
                    onClick={() => navigate(`/learn/${module.id}/${lesson.id}`)}
                    style={{ 
                      padding: '10px 12px',
                      marginBottom: 8,
                      background: 'var(--rd-surface)',
                      border: '1px solid var(--rd-border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--rd-accent)';
                      e.currentTarget.style.background = 'var(--rd-accent-dim)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--rd-border)';
                      e.currentTarget.style.background = 'var(--rd-surface)';
                    }}
                  >
                    <div style={{ fontSize: 14, color: 'var(--rd-ink-soft)', marginBottom: 4 }}>
                      {lesson.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--rd-muted)', lineHeight: 1.4 }}>
                      {lesson.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ))}

      <div style={{ marginTop: 32 }}>
        <SectionLabel>Practices</SectionLabel>
        <Card>
          <div 
            onClick={() => navigate('/practices/journalspeak')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: 18, 
              color: 'var(--rd-ink-soft)',
              marginBottom: 6,
            }}>
              JournalSpeak Practice
            </div>
            <div style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              A guided 30-minute expressive writing session to process emotions and support mind-body healing
            </div>
            <button style={{
              background: 'var(--rd-accent)',
              color: '#06121c',
              border: 'none',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              Start Practice →
            </button>
          </div>
        </Card>
      </div>
    </Screen>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Screen from '../../components/rd/Screen';
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

export default function LessonView() {
  const { moduleId, lessonId } = useParams<{ moduleId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const modules = modulesData.modules as Module[];
  const module = modules.find(m => m.id === moduleId);
  const lesson = module?.lessons.find(l => l.id === lessonId);

  useEffect(() => {
    if (!lesson) {
      setError('Lesson not found');
      setLoading(false);
      return;
    }

    async function loadContent() {
      if (!lesson) return;
      try {
        const data = await import(`../../../server/data/${lesson.dataFile}`);
        const lessonContent: any = {};
        lesson.contentKeys.forEach(key => {
          if (data.default[key]) {
            lessonContent[key] = data.default[key];
          }
        });
        setContent(lessonContent);
      } catch (err: any) {
        console.error('Failed to load lesson content:', err);
        setError('Could not load lesson content');
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, [lesson]);

  if (loading) {
    return (
      <Screen>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>
          Loading lesson...
        </div>
      </Screen>
    );
  }

  if (error || !lesson || !module) {
    return (
      <Screen>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14 }}>
          {error || 'Lesson not found'}
        </div>
        <button
          onClick={() => navigate('/learn')}
          style={{
            marginTop: 16,
            background: 'var(--rd-accent)',
            color: '#06121c',
            border: 'none',
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back to Learn
        </button>
      </Screen>
    );
  }

  const renderContent = (obj: any, level = 0): any => {
    if (!obj) return null;

    if (typeof obj === 'string') {
      return <p style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 12 }}>{obj}</p>;
    }

    if (Array.isArray(obj)) {
      return (
        <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
          {obj.map((item, idx) => (
            <li key={idx} style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
              {typeof item === 'string' ? item : renderContent(item, level + 1)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof obj === 'object') {
      return Object.entries(obj).map(([key, value]: [string, any]) => {
        if (key === 'title' && level === 0) {
          return (
            <h2 key={key} style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: 24, 
              fontWeight: 400,
              color: 'var(--rd-ink-soft)',
              marginBottom: 12,
              marginTop: 24,
            }}>
              {value}
            </h2>
          );
        }

        if (key === 'description' && level === 0) {
          return (
            <p key={key} style={{ 
              fontSize: 14, 
              color: 'var(--rd-muted)', 
              lineHeight: 1.6, 
              marginBottom: 16 
            }}>
              {value}
            </p>
          );
        }

        if (key === 'title' || key === 'description' || key === 'label') {
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 15, color: 'var(--rd-accent-bright)' }}>
                {value}
              </strong>
            </div>
          );
        }

        if (key === 'source' || key === 'sourceUrl' || key === 'creator') {
          return (
            <div key={key} style={{ fontSize: 13, color: 'var(--rd-muted-2)', marginBottom: 8 }}>
              <em>{key === 'sourceUrl' ? (
                <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rd-accent)' }}>
                  {value}
                </a>
              ) : value}</em>
            </div>
          );
        }

        return (
          <div key={key} style={{ marginBottom: 16 }}>
            {renderContent(value, level + 1)}
          </div>
        );
      });
    }

    return null;
  };

  return (
    <Screen>
      <button
        onClick={() => navigate('/learn')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--rd-muted)',
          fontSize: 13,
          cursor: 'pointer',
          marginBottom: 16,
          padding: 0,
        }}
      >
        ← Back to Learn
      </button>

      <div style={{ 
        fontSize: 11, 
        letterSpacing: '0.12em', 
        textTransform: 'uppercase', 
        color: 'var(--rd-muted-2)',
        marginBottom: 4,
      }}>
        {module.title}
      </div>

      <h1 style={{ 
        fontFamily: 'var(--font-display)', 
        fontSize: 28, 
        fontWeight: 400,
        lineHeight: 1.2,
        marginBottom: 8,
      }}>
        {lesson.title}
      </h1>

      <p style={{ 
        fontSize: 14, 
        color: 'var(--rd-muted)', 
        lineHeight: 1.5, 
        marginBottom: 32 
      }}>
        {lesson.description}
      </p>

      <div style={{
        background: 'var(--rd-surface)',
        border: '1px solid var(--rd-border)',
        borderRadius: 12,
        padding: 24,
      }}>
        {content && Object.entries(content).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 24 }}>
            {renderContent(value)}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--rd-border)' }}>
        <button
          onClick={() => {
            const currentIndex = module.lessons.findIndex(l => l.id === lessonId);
            if (currentIndex < module.lessons.length - 1) {
              const nextLesson = module.lessons[currentIndex + 1];
              navigate(`/learn/${moduleId}/${nextLesson.id}`);
            } else {
              const currentModuleIndex = modules.findIndex(m => m.id === moduleId);
              if (currentModuleIndex < modules.length - 1) {
                const nextModule = modules[currentModuleIndex + 1];
                navigate(`/learn/${nextModule.id}/${nextModule.lessons[0].id}`);
              } else {
                navigate('/learn');
              }
            }
          }}
          style={{
            background: 'var(--rd-accent)',
            color: '#06121c',
            border: 'none',
            borderRadius: 999,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Next Lesson →
        </button>
      </div>
    </Screen>
  );
}

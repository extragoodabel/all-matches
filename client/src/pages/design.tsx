import { PALETTES, COLORS, TYPE_SCALE, getProfileTheme } from "@/styles/theme";
import { PATTERN_NAMES, getPatternStyle } from "@/styles/patterns";
import { Heart, Sparkles, MessageCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function DesignPreview() {
  const [, setLocation] = useLocation();
  const sampleTheme = getProfileTheme(42);

  return (
    <div 
      className="min-h-screen p-8"
      style={{ 
        '--eg-primary': '#FF1493',
        '--eg-secondary': '#FFDC00',
        '--eg-accent': '#1A1A1A',
        '--eg-background': '#FFF8E7',
        background: '#FFF8E7',
      } as React.CSSProperties}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setLocation("/")}
            className="p-2 rounded-full eg-outline bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-4xl font-black uppercase tracking-tight">Design System</h1>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Color Palettes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PALETTES.map((palette) => (
              <div key={palette.name} className="eg-card p-4">
                <h3 className="font-bold uppercase text-sm mb-3">{palette.name}</h3>
                <div className="flex gap-2">
                  <div 
                    className="w-12 h-12 rounded-lg eg-outline"
                    style={{ background: palette.primary }}
                    title="Primary"
                  />
                  <div 
                    className="w-12 h-12 rounded-lg eg-outline"
                    style={{ background: palette.secondary }}
                    title="Secondary"
                  />
                  <div 
                    className="w-12 h-12 rounded-lg eg-outline"
                    style={{ background: palette.accent }}
                    title="Accent"
                  />
                  <div 
                    className="w-12 h-12 rounded-lg eg-outline"
                    style={{ background: palette.background }}
                    title="Background"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Raw Colors</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(COLORS).map(([name, value]) => (
              <div key={name} className="text-center">
                <div 
                  className="w-16 h-16 rounded-lg eg-outline-thick mb-2"
                  style={{ background: value }}
                />
                <span className="text-xs font-bold uppercase">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Patterns</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {PATTERN_NAMES.map((name) => (
              <div key={name} className="text-center">
                <div 
                  className="h-32 rounded-lg eg-outline-thick mb-2"
                  style={getPatternStyle(name)}
                />
                <span className="text-sm font-bold uppercase">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Typography</h2>
          <div className="space-y-4 eg-card p-6">
            <div className={TYPE_SCALE.hero}>Hero Text (5xl-6xl)</div>
            <div className={TYPE_SCALE.headline}>Headline Text (3xl-4xl)</div>
            <div className={TYPE_SCALE.title}>Title Text (2xl)</div>
            <div className={TYPE_SCALE.subtitle}>Subtitle Text (xl)</div>
            <div className={TYPE_SCALE.body}>Body Text (base)</div>
            <div className={TYPE_SCALE.caption}>Caption Text (sm)</div>
            <div className={TYPE_SCALE.label}>Label Text (xs uppercase)</div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <button className="eg-button rounded-full">Primary Button</button>
            <button className="eg-button-secondary rounded-full">Secondary Button</button>
            <button className="eg-button-white rounded-full">White Button</button>
            <button className="eg-button rounded-full" style={{ background: '#00D9A5' }}>
              <Heart className="w-4 h-4 mr-2" />
              With Icon
            </button>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Chips / Labels</h2>
          <div className="flex flex-wrap gap-3">
            <span className="eg-chip">Default Chip</span>
            <span className="eg-chip-active">Active Chip</span>
            <span className="eg-chip" style={{ background: '#00D9A5' }}>
              <Sparkles className="w-3 h-3 mr-1" />
              With Icon
            </span>
            <span className="eg-chip" style={{ background: '#B388FF' }}>Custom Color</span>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="eg-card p-6">
              <h3 className="font-bold text-lg mb-2">Standard Card</h3>
              <p className="text-gray-600">With default shadow and border.</p>
            </div>
            
            <div className="eg-card-tilted p-6">
              <h3 className="font-bold text-lg mb-2">Tilted Card (Left)</h3>
              <p className="text-gray-600">Slight rotation for playfulness.</p>
            </div>
            
            <div className="eg-card-tilted-right p-6">
              <h3 className="font-bold text-lg mb-2">Tilted Card (Right)</h3>
              <p className="text-gray-600">Opposite tilt direction.</p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Chat Bubbles</h2>
          <div className="eg-card p-6 max-w-md">
            <div className="space-y-3">
              <div className="flex justify-start">
                <div className="eg-chat-bubble-ai">Hey there! How's it going?</div>
              </div>
              <div className="flex justify-end">
                <div className="eg-chat-bubble-user">Pretty good! Just checking out this design system.</div>
              </div>
              <div className="flex justify-start">
                <div className="eg-chat-bubble-ai flex items-center gap-1.5 py-4">
                  <div className="eg-typing-dot" />
                  <div className="eg-typing-dot" />
                  <div className="eg-typing-dot" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Sample Profile Card</h2>
          <div 
            className="max-w-sm"
            style={{
              '--eg-primary': sampleTheme.palette.primary,
              '--eg-secondary': sampleTheme.palette.secondary,
              '--eg-accent': sampleTheme.palette.accent,
            } as React.CSSProperties}
          >
            <div
              className="absolute -z-10 rounded-2xl opacity-40"
              style={{
                ...getPatternStyle(sampleTheme.patternName),
                transform: 'rotate(-2deg) scale(1.05)',
              }}
            />
            
            <div className="eg-card">
              <div className="aspect-[3/4] bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-lg">Profile Image</span>
              </div>
              
              <div className="p-4" style={{ background: sampleTheme.palette.background }}>
                <h2 className="text-3xl font-black tracking-tight">
                  Alex, 28
                </h2>
              </div>
              
              <div 
                className="px-4 py-3"
                style={{ 
                  background: sampleTheme.palette.secondary,
                  borderTop: `3px solid ${sampleTheme.palette.accent}`,
                }}
              >
                <p className="text-sm font-medium">
                  Adventure seeker, coffee enthusiast, and aspiring comedian. Let's grab tacos!
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 uppercase tracking-wide">Loading States</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="eg-card p-8 text-center">
              <div className="flex justify-center gap-2 mb-4">
                <Sparkles className="w-8 h-8 text-[#FF1493] eg-bounce" style={{ animationDelay: '0ms' }} />
                <Heart className="w-8 h-8 text-[#FFDC00] eg-bounce" style={{ animationDelay: '150ms' }} />
                <Sparkles className="w-8 h-8 text-[#FF1493] eg-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-xl font-bold">Loading<span className="eg-loading-dots" /></p>
            </div>
            
            <div className="eg-card p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full eg-pulse-scale" style={{ background: '#FF1493' }} />
              <p className="text-xl font-bold">Pulse Animation</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

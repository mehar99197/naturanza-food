import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { aboutAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import {
  Save, CheckCircle, AlertCircle, Plus, Trash2, Loader2,
  Image as ImageIcon, Sparkles, BookText, BarChart3, Heart, Award,
} from 'lucide-react';

const VALUE_ICONS = [
  'Leaf', 'Heart', 'Globe', 'Shield', 'Award', 'Sparkles',
  'Sprout', 'Sun', 'Droplet', 'Recycle', 'HandHeart', 'BadgeCheck',
];

const DEFAULTS = {
  hero: { eyebrow: '', titleTop: '', titleHighlight: '', subtitle: '' },
  story: { heading: '', image: '', paragraphs: [''] },
  stats: [{ value: 0, suffix: '', label: '' }],
  values: { eyebrow: '', heading: '', items: [{ icon: 'Leaf', title: '', description: '' }] },
  team: { eyebrow: '', heading: '' },
  certifications: { heading: '', subtitle: '', items: [''] },
  sections: { story: true, stats: true, values: true, team: true, certifications: true },
};

const inputCls =
  'w-full rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100';
const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600';

function Card({ icon: Icon, title, desc, toggle, children }) {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Icon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {desc && <p className="text-xs text-slate-500">{desc}</p>}
          </div>
        </div>
        {toggle}
      </div>
      {children}
    </div>
  );
}

function VisibilityToggle({ checked, onChange }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2">
      <span className={`text-xs font-semibold ${checked ? 'text-emerald-600' : 'text-slate-400'}`}>
        {checked ? 'Visible' : 'Hidden'}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function AdminAbout() {
  const [content, setContent] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    aboutAPI.getAdminContent()
      .then((data) => { if (data && typeof data === 'object') setContent({ ...DEFAULTS, ...data }); })
      .catch(() => setError('Could not load About content'))
      .finally(() => setLoading(false));
  }, []);

  // Generic setters
  const setHero = (k, v) => setContent((c) => ({ ...c, hero: { ...c.hero, [k]: v } }));
  const setStory = (k, v) => setContent((c) => ({ ...c, story: { ...c.story, [k]: v } }));
  const setValuesMeta = (k, v) => setContent((c) => ({ ...c, values: { ...c.values, [k]: v } }));
  const setTeam = (k, v) => setContent((c) => ({ ...c, team: { ...c.team, [k]: v } }));
  const setCert = (k, v) => setContent((c) => ({ ...c, certifications: { ...c.certifications, [k]: v } }));
  const setSection = (k, v) => setContent((c) => ({ ...c, sections: { ...c.sections, [k]: v } }));

  // Story paragraphs
  const setPara = (i, v) => setContent((c) => {
    const paragraphs = [...(c.story.paragraphs || [])];
    paragraphs[i] = v;
    return { ...c, story: { ...c.story, paragraphs } };
  });
  const addPara = () => setContent((c) => ({ ...c, story: { ...c.story, paragraphs: [...(c.story.paragraphs || []), ''] } }));
  const removePara = (i) => setContent((c) => ({ ...c, story: { ...c.story, paragraphs: c.story.paragraphs.filter((_, x) => x !== i) } }));

  // Stats
  const setStat = (i, k, v) => setContent((c) => {
    const stats = [...c.stats];
    stats[i] = { ...stats[i], [k]: v };
    return { ...c, stats };
  });
  const addStat = () => setContent((c) => ({ ...c, stats: [...c.stats, { value: 0, suffix: '+', label: '' }] }));
  const removeStat = (i) => setContent((c) => ({ ...c, stats: c.stats.filter((_, x) => x !== i) }));

  // Values items
  const setValue = (i, k, v) => setContent((c) => {
    const items = [...c.values.items];
    items[i] = { ...items[i], [k]: v };
    return { ...c, values: { ...c.values, items } };
  });
  const addValue = () => setContent((c) => ({ ...c, values: { ...c.values, items: [...c.values.items, { icon: 'Leaf', title: '', description: '' }] } }));
  const removeValue = (i) => setContent((c) => ({ ...c, values: { ...c.values, items: c.values.items.filter((_, x) => x !== i) } }));

  // Certifications
  const setCertItem = (i, v) => setContent((c) => {
    const items = [...c.certifications.items];
    items[i] = v;
    return { ...c, certifications: { ...c.certifications, items } };
  });
  const addCertItem = () => setContent((c) => ({ ...c, certifications: { ...c.certifications, items: [...c.certifications.items, ''] } }));
  const removeCertItem = (i) => setContent((c) => ({ ...c, certifications: { ...c.certifications, items: c.certifications.items.filter((_, x) => x !== i) } }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await aboutAPI.uploadImage(file);
      if (res?.imageUrl) setStory('image', res.imageUrl);
    } catch {
      setError('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = await aboutAPI.updateContent(content);
      setContent({ ...DEFAULTS, ...saved });
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      </AdminLayout>
    );
  }

  const storyImgPreview = content.story.image
    ? (/^https?:\/\//i.test(content.story.image) || content.story.image === '/images/about-herbs.jpg'
        ? content.story.image
        : getAbsoluteImageUrl(content.story.image, { defaultFolder: 'blog' }))
    : '';

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1100px] space-y-5 pb-10">
        {toast && (
          <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-2xl bg-emerald-700 px-5 py-3.5 text-white shadow-2xl animate-slide-in">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-bold">About page saved!</p>
              <p className="text-xs text-green-100">Changes are now live on the site.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">About Page</h1>
            <p className="text-sm text-slate-600">Manage every section of your public About page.</p>
            {error && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-green-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>

        {/* Hero */}
        <Card icon={Sparkles} title="Hero" desc="The top banner — title and intro.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Eyebrow (small label)</label>
              <input className={inputCls} value={content.hero.eyebrow} onChange={(e) => setHero('eyebrow', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Title — first line</label>
              <input className={inputCls} value={content.hero.titleTop} onChange={(e) => setHero('titleTop', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Title — highlighted line (green)</label>
              <input className={inputCls} value={content.hero.titleHighlight} onChange={(e) => setHero('titleHighlight', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Subtitle</label>
              <textarea rows={2} className={inputCls} value={content.hero.subtitle} onChange={(e) => setHero('subtitle', e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Story */}
        <Card
          icon={BookText} title="Story" desc="The 'From Farm to Family' section."
          toggle={<VisibilityToggle checked={content.sections.story} onChange={(v) => setSection('story', v)} />}
        >
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <div>
                <label className={labelCls}>Image</label>
                <div className="relative h-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {storyImgPreview ? (
                    <img src={storyImgPreview} alt="Story" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon className="h-8 w-8" /></div>
                  )}
                </div>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading…' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
                </label>
              </div>
              <div>
                <label className={labelCls}>Heading</label>
                <input className={inputCls} value={content.story.heading} onChange={(e) => setStory('heading', e.target.value)} />
                <label className={`${labelCls} mt-3`}>Image URL (or upload on the left)</label>
                <input className={inputCls} value={content.story.image} onChange={(e) => setStory('image', e.target.value)} placeholder="/images/about-herbs.jpg" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={labelCls + ' mb-0'}>Paragraphs</label>
                <button onClick={addPara} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"><Plus className="h-3.5 w-3.5" /> Add</button>
              </div>
              <div className="space-y-2">
                {(content.story.paragraphs || []).map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea rows={2} className={inputCls} value={p} onChange={(e) => setPara(i, e.target.value)} />
                    <button onClick={() => removePara(i)} className="shrink-0 self-start rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <Card
          icon={BarChart3} title="Stats" desc="The green counter band."
          toggle={<VisibilityToggle checked={content.sections.stats} onChange={(v) => setSection('stats', v)} />}
        >
          <div className="space-y-2">
            {content.stats.map((s, i) => (
              <div key={i} className="grid grid-cols-[90px_70px_1fr_auto] items-center gap-2">
                <input type="number" className={inputCls} value={s.value} onChange={(e) => setStat(i, 'value', Number(e.target.value))} placeholder="Value" />
                <input className={inputCls} value={s.suffix} onChange={(e) => setStat(i, 'suffix', e.target.value)} placeholder="+" />
                <input className={inputCls} value={s.label} onChange={(e) => setStat(i, 'label', e.target.value)} placeholder="Label" />
                <button onClick={() => removeStat(i)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={addStat} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"><Plus className="h-3.5 w-3.5" /> Add stat</button>
        </Card>

        {/* Values */}
        <Card
          icon={Heart} title="Values" desc="The 'What We Stand For' cards."
          toggle={<VisibilityToggle checked={content.sections.values} onChange={(v) => setSection('values', v)} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Eyebrow</label>
              <input className={inputCls} value={content.values.eyebrow} onChange={(e) => setValuesMeta('eyebrow', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Heading</label>
              <input className={inputCls} value={content.values.heading} onChange={(e) => setValuesMeta('heading', e.target.value)} />
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {content.values.items.map((v, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
                  <select className={inputCls} value={v.icon} onChange={(e) => setValue(i, 'icon', e.target.value)}>
                    {VALUE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <input className={inputCls} value={v.title} onChange={(e) => setValue(i, 'title', e.target.value)} placeholder="Title" />
                  <button onClick={() => removeValue(i)} className="self-center rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
                <textarea rows={2} className={`${inputCls} mt-2`} value={v.description} onChange={(e) => setValue(i, 'description', e.target.value)} placeholder="Description" />
              </div>
            ))}
          </div>
          <button onClick={addValue} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"><Plus className="h-3.5 w-3.5" /> Add value</button>
        </Card>

        {/* Team meta + visibility (members managed on the Team page) */}
        <Card
          icon={Heart} title="Team section" desc="Headings only — members are managed on the Team page."
          toggle={<VisibilityToggle checked={content.sections.team} onChange={(v) => setSection('team', v)} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Eyebrow</label>
              <input className={inputCls} value={content.team.eyebrow} onChange={(e) => setTeam('eyebrow', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Heading</label>
              <input className={inputCls} value={content.team.heading} onChange={(e) => setTeam('heading', e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Certifications */}
        <Card
          icon={Award} title="Certifications" desc="The trust badges row."
          toggle={<VisibilityToggle checked={content.sections.certifications} onChange={(v) => setSection('certifications', v)} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Heading</label>
              <input className={inputCls} value={content.certifications.heading} onChange={(e) => setCert('heading', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Subtitle</label>
              <input className={inputCls} value={content.certifications.subtitle} onChange={(e) => setCert('subtitle', e.target.value)} />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {content.certifications.items.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputCls} value={c} onChange={(e) => setCertItem(i, e.target.value)} placeholder="Certification name" />
                <button onClick={() => removeCertItem(i)} className="shrink-0 rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={addCertItem} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"><Plus className="h-3.5 w-3.5" /> Add certification</button>
        </Card>
      </div>
    </AdminLayout>
  );
}

export default AdminAbout;

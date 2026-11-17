# Comment gérer les formulaires et la validation en React ? Composants contrôlés et non contrôlés

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment gérez-vous les formulaires et la validation en React ?
- Composants contrôlés ou non contrôlés : quand utiliser l'un ou l'autre ?

## The concept (short answer)
- **Contrôlé** : le state React est la source de vérité (`value` + `onChange`). Chaque frappe met à jour le state et déclenche un re-render. Idéal pour les réactions instantanées de l'UI : formatage en direct (numéros de carte), champs dépendants, activation d'un bouton, recherche à la frappe.
- **Non contrôlé** : le DOM conserve la valeur (`defaultValue`, lue via une `ref` ou `FormData` à la soumission). Pas de re-render à chaque frappe. Idéal pour les formulaires simples ou volumineux, les inputs de fichier (`<input type="file">` est toujours non contrôlé) et les Actions de formulaire de React 19.
- Couches de validation : HTML natif (`required`, `type="email"`, `pattern`) pour les bases gratuites, un **schéma** (zod/yup) pour les vraies règles, et **toujours une validation côté serveur**, car les vérifications côté client peuvent être contournées.
- Bonne UX : valider au blur ou à la soumission (pas dès la première frappe), afficher les erreurs à côté du champ, les relier avec `aria-invalid` et `aria-describedby`, mettre le focus sur le premier champ invalide, empêcher la double soumission, afficher les erreurs du serveur.
- Réponse « monde réel » : **react-hook-form** (inputs non contrôlés enregistrés par ref, donc peu de re-renders) + **zod** (un seul schéma pour les types et les règles, réutilisable côté serveur).
- Bug fréquent : faire passer un input de non contrôlé à contrôlé (`value={undefined}` puis une string). React affiche un avertissement ; initialisez avec `''`.

## Real-life example: the problem
Le formulaire d'inscription d'un SaaS B2B comporte 15 champs (entreprise, numéro de TVA, adresse, mot de passe, etc.), entièrement contrôlés avec un seul objet `useState` et une validation écrite à la main. Les utilisateurs signalent que la saisie rame sur les vieux portables, que les messages d'erreur apparaissent alors qu'ils sont encore en train de taper leur email, que le select « Company size » (taille de l'entreprise) envoie la string `"50"` au lieu d'un nombre, et que le backend reçoit des numéros de TVA invalides parce que la vérification n'existe que dans un seul `if`.

```jsx
function SignupForm() {
  const [form, setForm] = useState({ email: '', password: '', companySize: '', vat: '' /* ...11 autres */ });
  const [errors, setErrors] = useState({});

  const onChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);                 // tout le formulaire de 15 champs se re-render à chaque frappe
    setErrors(validate(next));     // erreurs affichées pendant que l'utilisateur tape encore
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/signup', { method: 'POST', body: JSON.stringify(form) }); // aucune vérification, aucune protection contre la double soumission
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="email" value={form.email} onChange={onChange} />
      {errors.email && <span>{errors.email}</span>}            {/* pas reliée à l'input */}
      <select name="companySize" value={form.companySize} onChange={onChange}>...</select>
      {/* ...13 autres champs */}
      <button>Create account</button>
    </form>
  );
}

function validate(f) {
  const e = {};
  if (!f.email.includes('@')) e.email = 'Invalid email';
  if (f.password.length < 8) e.password = 'Too short';
  return e; // TVA, taille de l'entreprise... oubliées
}
```

## How to fix it
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Un seul schéma : règles + type TypeScript. Importer le même schéma dans la route API.
export const signupSchema = z.object({
  email: z.string().email('Enter a valid work email'),
  password: z.string().min(12, 'At least 12 characters'),
  companySize: z.coerce.number().int().min(1, 'Select a company size'),
  vat: z.string().regex(/^[A-Z]{2}[0-9A-Z]{8,12}$/, 'Invalid VAT number').optional().or(z.literal('')),
});
type SignupInput = z.infer<typeof signupSchema>;

export function SignupForm() {
  const {
    register, handleSubmit, setError, setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), mode: 'onTouched' });

  const onSubmit = async (data: SignupInput) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      setError('email', { message: 'An account with this email already exists' });
      setFocus('email');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">Work email</label>
      <input id="email" type="email" {...register('email')}
             aria-invalid={!!errors.email} aria-describedby="email-error" />
      {errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}

      <label htmlFor="companySize">Company size</label>
      <select id="companySize" {...register('companySize')} defaultValue="">
        <option value="" disabled>Choose...</option>
        <option value="10">1-10</option>
        <option value="50">11-50</option>
      </select>
      {errors.companySize && <p role="alert">{errors.companySize.message}</p>}

      {/* password, vat... même pattern */}
      <button disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create account'}</button>
    </form>
  );
}
```
Pourquoi ça marche : react-hook-form enregistre des inputs **non contrôlés** par ref, donc la saisie ne re-render pas tout le formulaire. `mode: 'onTouched'` affiche les erreurs une fois que l'utilisateur quitte un champ, pas dès la première frappe. Le schéma zod valide tout au même endroit, convertit `companySize` en nombre, fournit un objet `data` typé, et le même schéma s'exécute côté serveur. Les erreurs sont accessibles, les erreurs serveur sont rattachées aux champs, et `isSubmitting` empêche la double soumission. Par défaut, le focus est aussi placé sur le premier champ invalide à la soumission.

Alternatives : pour un petit formulaire, un `<form action={action}>` non contrôlé avec `useActionState` de React 19 (ou une Server Action Next.js) et `FormData` fonctionne sans bibliothèque. N'utilisez un input contrôlé que pour les champs qui ont besoin d'un comportement en direct (par exemple le formatage d'un numéro de carte), ce que react-hook-form permet via `Controller`.

## How to say it in the interview
- « Contrôlé signifie que le state React possède la valeur : parfait pour réagir en direct, mais cela re-render à chaque frappe. Non contrôlé signifie que c'est le DOM qui la possède et que je la lis à la soumission : plus simple et plus rapide pour les gros formulaires. »
- « En production, j'utilise react-hook-form avec un schéma zod, et je revalide le même schéma côté serveur, car la validation côté client ne sert qu'à l'UX. »
- Piège : « la validation côté client suffit ». Faux : n'importe qui peut envoyer une requête avec curl.
- Compromis : le mode contrôlé offre plus de contrôle et un modèle mental plus simple pour les petits formulaires ; le mode non contrôlé passe mieux à l'échelle mais rend la logique « réagir à chaque changement » un peu plus difficile (`watch` dans react-hook-form déclenche des re-renders quand on l'utilise).

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { COUNTRIES } from "@Alumni-Network/api/countries";
import { Button } from "@Alumni-Network/ui/components/button";
import { CountryCombobox } from "@Alumni-Network/ui/components/country-combobox";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { Textarea } from "@Alumni-Network/ui/components/textarea";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => CURRENT_YEAR - i);

const WORK_STATUSES = [
  ["employed", "Employed"],
  ["self_employed", "Self-employed"],
  ["student", "Student"],
  ["unemployed", "Unemployed"],
  ["retired", "Retired"],
  ["other", "Other"],
] as const;

const DUTY_TYPES = [
  ["religious", "Religious"],
  ["political", "Political"],
  ["other", "Other"],
] as const;

const EDUCATION_LEVELS = [
  ["secondary", "Secondary"],
  ["certificate", "Certificate"],
  ["diploma", "Diploma"],
  ["bachelor", "Bachelor"],
  ["master", "Master"],
  ["doctorate", "Doctorate"],
  ["other", "Other"],
] as const;

type DutyEntry = {
  type: (typeof DUTY_TYPES)[number][0];
  title: string;
  organization: string;
  startYear: number;
  endYear: number | null;
  description: string;
};

type EducationEntry = {
  level: (typeof EDUCATION_LEVELS)[number][0];
  program: string;
  institution: string;
  yearCompleted: number;
  description: string;
};

const emptyDuty: DutyEntry = {
  type: "other",
  title: "",
  organization: "",
  startYear: CURRENT_YEAR,
  endYear: null,
  description: "",
};

const emptyEducation: EducationEntry = {
  level: "bachelor",
  program: "",
  institution: "",
  yearCompleted: CURRENT_YEAR,
  description: "",
};

function OptionList({ id, values }: { id: string; values?: string[] }) {
  return (
    <datalist id={id}>
      {(values ?? []).map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());
  const suggestions = useQuery(trpc.onboarding.suggestions.queryOptions());
  const updateProfile = useMutation(trpc.profile.updateProfile.mutationOptions());

  const [hydrated, setHydrated] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [campusStartYear, setCampusStartYear] = useState(CURRENT_YEAR);
  const [campusEndYear, setCampusEndYear] = useState(CURRENT_YEAR);
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [workStatus, setWorkStatus] = useState<(typeof WORK_STATUSES)[number][0] | "">("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [employer, setEmployer] = useState("");
  const [bio, setBio] = useState("");
  const [duties, setDuties] = useState<DutyEntry[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sessionPending && !session?.user) router.replace("/login");
  }, [session, sessionPending, router]);

  useEffect(() => {
    const p = profileQuery.data?.profile;
    if (!p || hydrated) return;
    setFullName(p.fullName);
    setPhone(p.phone ?? "");
    setCampusStartYear(p.campusStartYear ?? CURRENT_YEAR);
    setCampusEndYear(p.campusEndYear ?? CURRENT_YEAR);
    setCountryCode(p.countryCode ?? "");
    setCity(p.city ?? "");
    setRegion(p.region ?? "");
    setWorkStatus((p.workStatus as typeof workStatus) ?? "");
    setProfessionalTitle(p.professionalTitle ?? "");
    setEmployer(p.employer ?? "");
    setBio(p.bio ?? "");
    setDuties(profileQuery.data?.duties.map((d) => ({
      type: d.type as DutyEntry["type"],
      title: d.title,
      organization: d.organization,
      startYear: d.startYear,
      endYear: d.endYear ?? null,
      description: d.description ?? "",
    })) ?? []);
    setEducation(profileQuery.data?.education.map((e) => ({
      level: e.level as EducationEntry["level"],
      program: e.program,
      institution: e.institution,
      yearCompleted: e.yearCompleted,
      description: e.description ?? "",
    })) ?? []);
    setHydrated(true);
  }, [profileQuery.data, hydrated]);

  if (sessionPending || profileQuery.isPending || !hydrated) {
    return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:px-6"><p className="text-sm text-muted-foreground">Loading your profile…</p></main>;
  }
  if (!session?.user) return null;
  if (profileQuery.isError) {
    return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:px-6"><p className="text-sm text-destructive">We could not load your profile. Refresh to try again.</p></main>;
  }
  if (!profileQuery.data?.profile) {
    return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:px-6"><p className="text-sm text-muted-foreground">You have no alumni record yet. Finish onboarding first.</p></main>;
  }

  const titleRequired = workStatus === "employed" || workStatus === "self_employed";

  function validate() {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2 || fullName.trim().length > 120) next.fullName = "Name must be 2–120 characters.";
    if (phone.trim() && !/^\+?[0-9 ]{7,20}$/.test(phone.trim())) next.phone = "Enter a valid phone number (7–20 characters).";
    if (campusEndYear < campusStartYear) next.campusEndYear = "End year cannot precede start year.";
    if (!countryCode) next.countryCode = "Select a valid country.";
    if (city.trim().length < 2 || city.trim().length > 80) next.city = "City must be 2–80 characters.";
    if (region.trim() && (region.trim().length < 2 || region.trim().length > 80)) next.region = "Region must be 2–80 characters.";
    if (!workStatus) next.workStatus = "Work status is required.";
    if (titleRequired && (professionalTitle.trim().length < 2 || professionalTitle.trim().length > 120)) next.professionalTitle = "Professional title is required (2–120 characters).";
    else if (!titleRequired && professionalTitle.trim().length > 120) next.professionalTitle = "Professional title must be at most 120 characters.";
    if (employer.trim().length > 120) next.employer = "Employer must be at most 120 characters.";
    if (bio.trim().length > 300) next.bio = "Bio must be at most 300 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (!workStatus) return;
    updateProfile.mutate(
      {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        campusStartYear,
        campusEndYear,
        countryCode,
        city: city.trim(),
        region: region.trim() || null,
        workStatus,
        professionalTitle: professionalTitle.trim() || null,
        employer: employer.trim() || null,
        bio: bio.trim() || null,
        duties: duties.map((d) => ({ type: d.type, title: d.title.trim(), organization: d.organization.trim(), startYear: d.startYear, endYear: d.endYear, description: d.description.trim() || null })),
        education: education.map((e) => ({ level: e.level, program: e.program.trim(), institution: e.institution.trim(), yearCompleted: e.yearCompleted, description: e.description.trim() || null })),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: trpc.profile.getMyProfile.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.onboarding.status.queryKey() });
          toast.success("Profile updated");
          router.push("/profile");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">Settings</p>
      <h1 className="mt-2">Profile</h1>
      <p className="mt-3 text-sm text-muted-foreground">Edit your alumni record. Changes save when you click Save.</p>

      <div className="mt-8 space-y-6">
        <section className="space-y-5 rounded-lg border bg-card p-6">
          <h2 className="font-heading text-base font-medium">Identity and campus</h2>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} maxLength={120} aria-invalid={!!errors.fullName} onChange={(e) => setFullName(e.target.value)} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" type="tel" value={phone} aria-invalid={!!errors.phone} onChange={(e) => setPhone(e.target.value)} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campusStartYear">Campus start year</Label>
              <select id="campusStartYear" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={campusStartYear} onChange={(e) => setCampusStartYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campusEndYear">Campus end year</Label>
              <select id="campusEndYear" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={campusEndYear} onChange={(e) => setCampusEndYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              {errors.campusEndYear && <p className="text-xs text-destructive">{errors.campusEndYear}</p>}
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-lg border bg-card p-6">
          <h2 className="font-heading text-base font-medium">Location and work</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="countryCode">Country</Label>
              <CountryCombobox id="countryCode" countries={COUNTRIES} value={countryCode} onValueChange={setCountryCode} />
              {errors.countryCode && <p className="text-xs text-destructive">{errors.countryCode}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" list="city-options" autoComplete="off" value={city} aria-invalid={!!errors.city} onChange={(e) => {
                const nextCity = e.target.value;
                const known = suggestions.data?.cityRegions.find((place) => place.city.toLowerCase() === nextCity.trim().toLowerCase());
                setCity(nextCity);
                if (!region && known?.region) setRegion(known.region);
              }} />
              <OptionList id="city-options" values={suggestions.data?.cities} />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Region (optional)</Label>
              <Input id="region" list="region-options" autoComplete="off" value={region} onChange={(e) => setRegion(e.target.value)} />
              <OptionList id="region-options" values={suggestions.data?.regions} />
              {errors.region && <p className="text-xs text-destructive">{errors.region}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workStatus">Work status</Label>
              <select id="workStatus" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={workStatus} onChange={(e) => setWorkStatus(e.target.value as typeof workStatus)}>
                <option value="">Select work status</option>
                {WORK_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.workStatus && <p className="text-xs text-destructive">{errors.workStatus}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="professionalTitle">Professional title</Label>
            <Input id="professionalTitle" list="professional-title-options" autoComplete="off" value={professionalTitle} maxLength={120} aria-invalid={!!errors.professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} />
            <OptionList id="professional-title-options" values={suggestions.data?.professionalTitles} />
            <p className="text-xs text-muted-foreground">Required when employed or self-employed.</p>
            {errors.professionalTitle && <p className="text-xs text-destructive">{errors.professionalTitle}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employer">Employer (optional)</Label>
            <Input id="employer" list="employer-options" autoComplete="off" value={employer} maxLength={120} onChange={(e) => setEmployer(e.target.value)} />
            <OptionList id="employer-options" values={suggestions.data?.employers} />
            {errors.employer && <p className="text-xs text-destructive">{errors.employer}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Short bio (optional)</Label>
            <Textarea id="bio" maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-medium">Duties</h2>
            <Button type="button" size="sm" variant="outline" disabled={duties.length >= 10} onClick={() => setDuties([...duties, { ...emptyDuty }])}>Add duty</Button>
          </div>
          {duties.length === 0 && <p className="text-sm text-muted-foreground">No duties recorded.</p>}
          {duties.map((entry, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <select aria-label={`Duty ${index + 1} type`} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={entry.type} onChange={(e) => setDuties(duties.map((item, i) => i === index ? { ...item, type: e.target.value as DutyEntry["type"] } : item))}>
                  {DUTY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Input aria-label={`Duty ${index + 1} title`} placeholder="Title" value={entry.title} onChange={(e) => setDuties(duties.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} />
                <Input aria-label={`Duty ${index + 1} organization`} placeholder="Organization" value={entry.organization} onChange={(e) => setDuties(duties.map((item, i) => i === index ? { ...item, organization: e.target.value } : item))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select aria-label={`Duty ${index + 1} start year`} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={entry.startYear} onChange={(e) => setDuties(duties.map((item, i) => i === index ? { ...item, startYear: Number(e.target.value) } : item))}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select aria-label={`Duty ${index + 1} end year`} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={entry.endYear ?? ""} onChange={(e) => setDuties(duties.map((item, i) => i === index ? { ...item, endYear: e.target.value === "" ? null : Number(e.target.value) } : item))}>
                  <option value="">Ongoing</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Input aria-label={`Duty ${index + 1} description`} placeholder="Description (optional)" value={entry.description} onChange={(e) => setDuties(duties.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} />
                <Button type="button" size="sm" variant="ghost" className="ml-3" onClick={() => setDuties(duties.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-medium">Education</h2>
            <Button type="button" size="sm" variant="outline" disabled={education.length >= 10} onClick={() => setEducation([...education, { ...emptyEducation }])}>Add education</Button>
          </div>
          {education.length === 0 && <p className="text-sm text-muted-foreground">No education recorded.</p>}
          {education.map((entry, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <select aria-label={`Education ${index + 1} level`} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={entry.level} onChange={(e) => setEducation(education.map((item, i) => i === index ? { ...item, level: e.target.value as EducationEntry["level"] } : item))}>
                  {EDUCATION_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Input aria-label={`Education ${index + 1} program`} placeholder="Program" value={entry.program} onChange={(e) => setEducation(education.map((item, i) => i === index ? { ...item, program: e.target.value } : item))} />
                <Input aria-label={`Education ${index + 1} institution`} placeholder="Institution" value={entry.institution} onChange={(e) => setEducation(education.map((item, i) => i === index ? { ...item, institution: e.target.value } : item))} />
                <select aria-label={`Education ${index + 1} year completed`} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={entry.yearCompleted} onChange={(e) => setEducation(education.map((item, i) => i === index ? { ...item, yearCompleted: Number(e.target.value) } : item))}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Input aria-label={`Education ${index + 1} description`} placeholder="Description (optional)" value={entry.description} onChange={(e) => setEducation(education.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} />
                <Button type="button" size="sm" variant="ghost" className="ml-3" onClick={() => setEducation(education.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            </div>
          ))}
        </section>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={updateProfile.isPending} onClick={() => router.push("/profile")}>Cancel</Button>
          <Button type="button" disabled={updateProfile.isPending} onClick={save}>{updateProfile.isPending ? "Saving…" : "Save profile"}</Button>
        </div>
      </div>
    </main>
  );
}

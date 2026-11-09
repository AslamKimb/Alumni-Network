"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { COUNTRIES } from "@Alumni-Network/api/countries";
import { CountryCombobox } from "@Alumni-Network/ui/components/country-combobox";
import { Button } from "@Alumni-Network/ui/components/button";
import { Checkbox } from "@Alumni-Network/ui/components/checkbox";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

type Session = typeof authClient.$Infer.Session;

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

type Step1 = {
  phone: string;
  campusStartYear: number;
  campusEndYear: number;
};
type Step2 = {
  countryCode: string;
  city: string;
  region: string;
  workStatus: (typeof WORK_STATUSES)[number][0] | "";
  professionalTitle: string;
  employer: string;
  bio: string;
};
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

const STEP_TITLES = [
  "Identity and campus",
  "Location and work",
  "Duties and education",
] as const;

// Native datalist: the browser filters on the characters typed so far, and a
// click on a suggestion fills the field. No extra dependency.
function OptionList({ id, values }: { id: string; values?: string[] }) {
  return (
    <datalist id={id}>
      {(values ?? []).map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

export default function Onboarding({ session }: { session: Session }) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const status = useQuery(trpc.onboarding.status.queryOptions());
  const suggestions = useQuery(trpc.onboarding.suggestions.queryOptions());
  const acceptConsent = useMutation(trpc.onboarding.acceptConsent.mutationOptions());
  const saveStep1 = useMutation(trpc.onboarding.saveStep1.mutationOptions());
  const saveStep2 = useMutation(trpc.onboarding.saveStep2.mutationOptions());
  const saveStep3 = useMutation(trpc.onboarding.saveStep3.mutationOptions());

  const [viewStep, setViewStep] = useState<number | null>(null);
  const [step1, setStep1] = useState<Step1 | null>(null);
  const [step2, setStep2] = useState<Step2 | null>(null);
  const [duties, setDuties] = useState<DutyEntry[] | null>(null);
  const [education, setEducation] = useState<EducationEntry[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentFullName, setConsentFullName] = useState(session.user.name);

  // Hydrate the forms from whatever the server already saved, so a resumed
  // session shows the same values instead of blanks.
  useEffect(() => {
    const data = status.data;
    if (!data?.profile) return;
    setStep1((current) =>
      current ?? {
        phone: data.profile.phone ?? "",
        campusStartYear: data.profile.campusStartYear ?? CURRENT_YEAR,
        campusEndYear: data.profile.campusEndYear ?? CURRENT_YEAR,
      },
    );
    setStep2((current) =>
      current ?? {
        countryCode: data.profile.countryCode ?? "",
        city: data.profile.city ?? "",
        region: data.profile.region ?? "",
        workStatus: (data.profile.workStatus as Step2["workStatus"]) ?? "",
        professionalTitle: data.profile.professionalTitle ?? "",
        employer: data.profile.employer ?? "",
        bio: data.profile.bio ?? "",
      },
    );
    setDuties(
      (current) =>
        current ??
        data.duties.map((entry) => ({
          type: entry.type as DutyEntry["type"],
          title: entry.title,
          organization: entry.organization,
          startYear: entry.startYear,
          endYear: entry.endYear ?? null,
          description: entry.description ?? "",
        })),
    );
    setEducation(
      (current) =>
        current ??
        data.education.map((entry) => ({
          level: entry.level as EducationEntry["level"],
          program: entry.program,
          institution: entry.institution,
          yearCompleted: entry.yearCompleted,
          description: entry.description ?? "",
        })),
    );
  }, [status.data]);

  if (status.isPending) {
    return <p className="py-16 text-sm text-muted-foreground">Loading your record…</p>;
  }

  if (status.isError) {
    return (
      <p role="alert" className="py-16 text-sm text-red-700 dark:text-destructive">
        We could not load your record. Refresh to try again.
      </p>
    );
  }

  const data = status.data;
  if (!data) return null;

  if (data.completed) {
    return (
      <div className="py-16">
        <h1 className="text-2xl font-semibold">Your record is complete</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You can update it any time from your dashboard.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  // Legacy accounts have no profile; they must accept explicitly before any
  // record is created, so consent is never inferred from account age.
  if (data.needsConsent) {
    return (
      <div className="max-w-xl">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
          Before you continue
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Store your alumni record</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account was created before we recorded consent. Confirm once to create
          your record. Only administrators can read it.
        </p>
        <div className="mt-6 space-y-1.5">
          <Label htmlFor="consentFullName">Full name</Label>
          <Input
            id="consentFullName"
            value={consentFullName}
            maxLength={120}
            aria-invalid={consentFullName.trim().length < 2 || consentFullName.trim().length > 120}
            aria-describedby={
              consentFullName.trim().length < 2 || consentFullName.trim().length > 120
                ? "consentFullName-error"
                : undefined
            }
            onChange={(event) => setConsentFullName(event.target.value)}
          />
          {(consentFullName.trim().length < 2 || consentFullName.trim().length > 120) && (
            <p id="consentFullName-error" role="alert" className="text-xs text-red-700 dark:text-destructive">
              Name must be 2–120 characters.
            </p>
          )}
        </div>
        <label className="mt-6 flex items-start gap-3">
          <Checkbox
            checked={consent}
            aria-label="I consent to storing my alumni record"
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <span className="text-sm leading-relaxed">
            I consent to storing my alumni record.
          </span>
        </label>
        <Button
          className="mt-6"
          disabled={
            !consent ||
            acceptConsent.isPending ||
            consentFullName.trim().length < 2 ||
            consentFullName.trim().length > 120
          }
          onClick={() =>
            acceptConsent.mutate({ consent: true, fullName: consentFullName }, {
              onSuccess: () => window.location.reload(),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          {acceptConsent.isPending ? "Saving…" : "Continue"}
        </Button>
      </div>
    );
  }

  const { profile } = data;
  if (!profile) return null;
  const savedStep = data.step ?? 1;
  const currentStep = viewStep ?? savedStep;
  const busy = saveStep1.isPending || saveStep2.isPending || saveStep3.isPending;
  const values1 = step1 ?? {
    phone: profile.phone ?? "",
    campusStartYear: profile.campusStartYear ?? CURRENT_YEAR,
    campusEndYear: profile.campusEndYear ?? CURRENT_YEAR,
  };
  const values2 = step2 ?? {
    countryCode: profile.countryCode ?? "",
    city: profile.city ?? "",
    region: profile.region ?? "",
    workStatus: (profile.workStatus as Step2["workStatus"]) ?? "",
    professionalTitle: profile.professionalTitle ?? "",
    employer: profile.employer ?? "",
    bio: profile.bio ?? "",
  };
  const dutyList = duties ?? [];
  const educationList = education ?? [];

  function afterSave() {
    setViewStep(null);
    queryClient.invalidateQueries({ queryKey: trpc.onboarding.status.queryKey() });
  }

  function saveCurrentStep() {
    if (currentStep === 1) {
      if (values1.campusEndYear < values1.campusStartYear) {
        toast.error("End year cannot precede start year");
        return;
      }
      saveStep1.mutate(
        {
          phone: values1.phone.trim() === "" ? null : values1.phone.trim(),
          campusStartYear: values1.campusStartYear,
          campusEndYear: values1.campusEndYear,
        },
        { onSuccess: afterSave, onError: (error) => toast.error(error.message) },
      );
      return;
    }

    if (currentStep === 2) {
      if (!values2.countryCode || values2.city.trim().length < 2 || !values2.workStatus) {
        toast.error("Country, city, and work status are required");
        return;
      }
      const titleRequired =
        values2.workStatus === "employed" || values2.workStatus === "self_employed";
      if (titleRequired && values2.professionalTitle.trim().length < 2) {
        toast.error("Professional title is required for your work status");
        return;
      }
      saveStep2.mutate(
        {
          countryCode: values2.countryCode,
          city: values2.city.trim(),
          region: values2.region.trim() || null,
          workStatus: values2.workStatus,
          professionalTitle: values2.professionalTitle.trim() || null,
          employer: values2.employer.trim() || null,
          bio: values2.bio.trim() || null,
        },
        { onSuccess: afterSave, onError: (error) => toast.error(error.message) },
      );
      return;
    }

    for (const entry of dutyList) {
      if (!entry.title.trim() || !entry.organization.trim()) {
        toast.error("Each duty needs a title and organization");
        return;
      }
    }
    for (const entry of educationList) {
      if (!entry.program.trim() || !entry.institution.trim()) {
        toast.error("Each education entry needs a program and institution");
        return;
      }
    }

    saveStep3.mutate(
      {
        duties: dutyList.map((entry) => ({
          type: entry.type,
          title: entry.title.trim(),
          organization: entry.organization.trim(),
          startYear: entry.startYear,
          endYear: entry.endYear,
          description: entry.description.trim() || null,
        })),
        education: educationList.map((entry) => ({
          level: entry.level,
          program: entry.program.trim(),
          institution: entry.institution.trim(),
          yearCompleted: entry.yearCompleted,
          description: entry.description.trim() || null,
        })),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: trpc.onboarding.status.queryKey() });
          toast.success("Your record is complete");
          router.push("/dashboard");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Step {currentStep} of 3
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{STEP_TITLES[currentStep - 1]}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each step saves as you go. Sign out and back in and you will resume here.
      </p>

      <ol className="mt-6 flex gap-2" aria-label="Onboarding progress">
        {STEP_TITLES.map((title, index) => (
          <li
            key={title}
            aria-current={index + 1 === currentStep ? "step" : undefined}
            className={`h-1 flex-1 rounded-full ${index + 1 <= currentStep ? "bg-primary" : "bg-muted"}`}
          >
            <span className="sr-only">{title}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-5">
        {currentStep === 1 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={profile.fullName} readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">From your record.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={values1.phone}
                onChange={(e) => setStep1({ ...values1, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campusStartYear">Campus start year</Label>
                <select
                  id="campusStartYear"
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                  value={values1.campusStartYear}
                  onChange={(e) =>
                    setStep1({ ...values1, campusStartYear: Number(e.target.value) })
                  }
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campusEndYear">Campus end year</Label>
                <select
                  id="campusEndYear"
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                  value={values1.campusEndYear}
                  onChange={(e) =>
                    setStep1({ ...values1, campusEndYear: Number(e.target.value) })
                  }
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {currentStep === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="countryCode">Country</Label>
                <CountryCombobox
                  id="countryCode"
                  countries={COUNTRIES}
                  value={values2.countryCode}
                  onValueChange={(countryCode) =>
                    setStep2({ ...values2, countryCode })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  list="city-options"
                  autoComplete="off"
                  value={values2.city}
                  onChange={(e) => {
                    const city = e.target.value;
                    // A city someone already used brings its region along,
                    // unless this person typed a region themselves.
                    const known = suggestions.data?.cityRegions.find(
                      (place) => place.city.toLowerCase() === city.trim().toLowerCase(),
                    );
                    setStep2({ ...values2, city, region: values2.region || known?.region || "" });
                  }}
                />
                <OptionList id="city-options" values={suggestions.data?.cities} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="region">Region (optional)</Label>
                <Input
                  id="region"
                  list="region-options"
                  autoComplete="off"
                  value={values2.region}
                  onChange={(e) => setStep2({ ...values2, region: e.target.value })}
                />
                <OptionList id="region-options" values={suggestions.data?.regions} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workStatus">Work status</Label>
                <select
                  id="workStatus"
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                  value={values2.workStatus}
                  onChange={(e) =>
                    setStep2({ ...values2, workStatus: e.target.value as Step2["workStatus"] })
                  }
                >
                  <option value="">Select work status</option>
                  {WORK_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professionalTitle">Professional title</Label>
              <Input
                id="professionalTitle"
                list="professional-title-options"
                autoComplete="off"
                value={values2.professionalTitle}
                onChange={(e) =>
                  setStep2({ ...values2, professionalTitle: e.target.value })
                }
              />
              <OptionList
                id="professional-title-options"
                values={suggestions.data?.professionalTitles}
              />
              <p className="text-xs text-muted-foreground">
                Required when employed or self-employed.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employer">Employer (optional)</Label>
              <Input
                id="employer"
                list="employer-options"
                autoComplete="off"
                value={values2.employer}
                onChange={(e) => setStep2({ ...values2, employer: e.target.value })}
              />
              <OptionList id="employer-options" values={suggestions.data?.employers} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Short bio (optional)</Label>
              <textarea
                id="bio"
                maxLength={300}
                rows={3}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                value={values2.bio}
                onChange={(e) => setStep2({ ...values2, bio: e.target.value })}
              />
            </div>
          </>
        )}

        {currentStep === 3 && (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Duties</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={dutyList.length >= 10}
                  onClick={() => setDuties([...dutyList, { ...emptyDuty }])}
                >
                  Add duty
                </Button>
              </div>
              {dutyList.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No duties added. This step is optional.
                </p>
              )}
              {dutyList.map((entry, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`duty-type-${index}`}>Type</Label>
                      <select
                        id={`duty-type-${index}`}
                        aria-label="Duty type"
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                        value={entry.type}
                        onChange={(e) =>
                          setDuties(
                            dutyList.map((item, i) =>
                              i === index
                                ? { ...item, type: e.target.value as DutyEntry["type"] }
                                : item,
                            ),
                          )
                        }
                      >
                        {DUTY_TYPES.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`duty-title-${index}`}>Title</Label>
                      <Input
                        id={`duty-title-${index}`}
                        aria-label="Duty title"
                        placeholder="Title"
                        value={entry.title}
                        onChange={(e) =>
                          setDuties(
                            dutyList.map((item, i) =>
                              i === index ? { ...item, title: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`duty-organization-${index}`}>Organization</Label>
                      <Input
                        id={`duty-organization-${index}`}
                        aria-label="Duty organization"
                        placeholder="Organization"
                        value={entry.organization}
                        onChange={(e) =>
                          setDuties(
                            dutyList.map((item, i) =>
                              i === index ? { ...item, organization: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`duty-start-${index}`}>Start year</Label>
                      <select
                        id={`duty-start-${index}`}
                        aria-label="Duty start year"
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                        value={entry.startYear}
                        onChange={(e) =>
                          setDuties(
                            dutyList.map((item, i) =>
                              i === index ? { ...item, startYear: Number(e.target.value) } : item,
                            ),
                          )
                        }
                      >
                        {YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`duty-end-${index}`}>End year</Label>
                      <select
                        id={`duty-end-${index}`}
                        aria-label="Duty end year"
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                        value={entry.endYear ?? ""}
                        onChange={(e) =>
                          setDuties(
                            dutyList.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    endYear: e.target.value === "" ? null : Number(e.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Ongoing</option>
                        {YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor={`duty-description-${index}`}>Description (optional)</Label>
                      <Input
                        id={`duty-description-${index}`}
                        aria-label="Duty description"
                        placeholder="Description (optional)"
                        value={entry.description}
                        onChange={(e) =>
                          setDuties(
                            dutyList.map((item, i) =>
                              i === index ? { ...item, description: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-3 shrink-0"
                      onClick={() => setDuties(dutyList.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Education</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={educationList.length >= 10}
                  onClick={() => setEducation([...educationList, { ...emptyEducation }])}
                >
                  Add education
                </Button>
              </div>
              {educationList.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No education added. This step is optional.
                </p>
              )}
              {educationList.map((entry, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`education-level-${index}`}>Level</Label>
                      <select
                        id={`education-level-${index}`}
                        aria-label="Education level"
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                        value={entry.level}
                        onChange={(e) =>
                          setEducation(
                            educationList.map((item, i) =>
                              i === index
                                ? { ...item, level: e.target.value as EducationEntry["level"] }
                                : item,
                            ),
                          )
                        }
                      >
                        {EDUCATION_LEVELS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`education-program-${index}`}>Program</Label>
                      <Input
                        id={`education-program-${index}`}
                        aria-label="Education program"
                        placeholder="Program"
                        value={entry.program}
                        onChange={(e) =>
                          setEducation(
                            educationList.map((item, i) =>
                              i === index ? { ...item, program: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`education-institution-${index}`}>Institution</Label>
                      <Input
                        id={`education-institution-${index}`}
                        aria-label="Education institution"
                        placeholder="Institution"
                        value={entry.institution}
                        onChange={(e) =>
                          setEducation(
                            educationList.map((item, i) =>
                              i === index ? { ...item, institution: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`education-year-${index}`}>Year completed</Label>
                      <select
                        id={`education-year-${index}`}
                        aria-label="Year completed"
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
                        value={entry.yearCompleted}
                        onChange={(e) =>
                          setEducation(
                            educationList.map((item, i) =>
                              i === index
                                ? { ...item, yearCompleted: Number(e.target.value) }
                                : item,
                            ),
                          )
                        }
                      >
                        {YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor={`education-description-${index}`}>Description (optional)</Label>
                      <Input
                        id={`education-description-${index}`}
                        aria-label="Education description"
                        placeholder="Description (optional)"
                        value={entry.description}
                        onChange={(e) =>
                          setEducation(
                            educationList.map((item, i) =>
                              i === index ? { ...item, description: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-3 shrink-0"
                      onClick={() => setEducation(educationList.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className={currentStep === 1 ? "invisible" : undefined}
          onClick={() => setViewStep(Math.max(1, currentStep - 1))}
        >
          Back
        </Button>
        <Button type="button" disabled={busy} onClick={saveCurrentStep}>
          {busy ? "Saving…" : currentStep === 3 ? "Finish" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

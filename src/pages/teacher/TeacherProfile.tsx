import { useState, useEffect } from "react";
import { Card, PageHeader, Button, Badge } from "../../components/Layout";
import { useAuth } from "../../contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Edit2, Save, X, AlertTriangle, CheckCircle2, Building2, BookOpen } from "lucide-react";
import { PhotoUpload, validatePhotoFile } from "../../components/PhotoUpload";
import { cn } from "../../utils/cn";

import { API_BASE } from "../../data/api";
const token = () => localStorage.getItem("examshield_token") || "";

interface TeacherProfile {
  id: number;
  name: string;
  email: string;
  emp_id: string;
  department: string;
  photo: string | null;
  assigned_subjects: string;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchTeacherProfile(): Promise<TeacherProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/teacher/profile`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function TeacherProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TeacherProfile | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const data = await fetchTeacherProfile();
      setProfile(data);
      setForm(data);
      setLoading(false);
    })();
  }, []);

  const onPhotoSelect = async (file: File) => {
    const err = validatePhotoFile(file);
    if (err) { setSaveError(err); return; }
    setPhotoUploading(true);
    setSaveError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`${API_BASE}/api/teacher/profile/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to upload photo");
      }
      const data = await res.json();
      setProfile((p) => p ? { ...p, photo: data.photo, avatar: data.photo } : p);
      setForm((f) => f ? { ...f, photo: data.photo, avatar: data.photo } : f);
      setSaveSuccess("Profile photo updated");
    } catch (e: any) {
      setSaveError(e.message || "Photo upload failed");
    }
    setPhotoUploading(false);
  };

  const saveProfile = async () => {
    if (!form) return;
    setSaveError(null);
    setSaveSuccess(null);
    const res = await fetch(`${API_BASE}/api/teacher/profile/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ name: form.name }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaveError(j.detail || "Failed to save profile");
      return;
    }
    setProfile(form);
    setEditing(false);
    setSaveSuccess("Profile saved");
  };

  const changePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (passwordForm.next.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher/profile/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.next,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to change password");
      }
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordSuccess("Password updated successfully");
    } catch (e: any) {
      setPasswordError(e.message || "Failed to change password");
    }
    setPasswordSaving(false);
  };

  if (loading || !profile || !form) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  const subjects = profile.assigned_subjects
    ? profile.assigned_subjects.split(',').map(s => s.trim())
    : [];

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account settings and preferences" />
      
      {(saveError || saveSuccess) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm flex items-start gap-2", saveError ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {saveError ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>{saveError || saveSuccess}</div>
        </div>
      )}

      {(passwordError || passwordSuccess) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm flex items-start gap-2", passwordError ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {passwordError ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>{passwordError || passwordSuccess}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="p-6 lg:col-span-1">
          <div className="text-center">
            <PhotoUpload
              photoUrl={profile.photo}
              onFileSelect={onPhotoSelect}
              uploading={photoUploading}
              className="mx-auto"
            />
            <p className="text-xs text-slate-500 mt-2">Click camera to change photo</p>
            <h3 className="text-xl font-bold mt-4">{profile.name}</h3>
            <p className="text-sm text-slate-500 mb-2">{profile.emp_id}</p>
            <Badge variant="violet">Teacher</Badge>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-sm">
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {profile.email}</p>
              <p className="flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /> {profile.department}</p>
              {subjects.length > 0 && (
                <p className="flex items-start gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <BookOpen className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Assigned Subjects</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {subjects.map((s, i) => <Badge key={i} variant="indigo" className="text-xs">{s}</Badge>)}
                    </div>
                  </div>
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Edit Profile & Change Password */}
        <Card className="p-6 lg:col-span-2">
          <div className="space-y-6">
            {/* Edit Profile Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Personal Information</h3>
                {!editing && (
                  <Button onClick={() => setEditing(true)} variant="secondary" size="sm">
                    <Edit2 className="w-4 h-4" /> Edit
                  </Button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveProfile} variant="primary">
                      <Save className="w-4 h-4" /> Save
                    </Button>
                    <Button onClick={() => { setEditing(false); setForm(profile); }} variant="secondary">
                      <X className="w-4 h-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-slate-600 dark:text-slate-400">{profile.name}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800" />

            {/* Change Password Section */}
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5" /> Change Password
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    placeholder="Enter your current password"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                    placeholder="Enter new password (min. 6 characters)"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <Button onClick={changePassword} disabled={passwordSaving} variant="primary" className="w-full">
                  {passwordSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

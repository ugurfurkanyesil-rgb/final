import React from "react";

export default function ComponentName() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-white to-rose-100 p-8">
      <div className="rounded-3xl bg-white shadow-xl border border-slate-200 p-10 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Component Preview Active</h1>
        <p className="text-slate-600">This is the live preview component for <code>ComponentName</code>.</p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import AppShell from '../components/AppShell';

export default function DataEntryPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('New Jersey');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [listingUrl, setListingUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Restaurant Name is required.' });
      return;
    }

    if (!phone.trim()) {
      setStatusMessage({ type: 'error', text: 'Phone Number is required.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          contact_person: contactPerson.trim(),
          city: city.trim(),
          state: state.trim(),
          zip_code: zipCode.trim(),
          address: address.trim(),
          listing_url: listingUrl.trim(),
          notes: notes.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `✓ Successfully added "${data.restaurant.name}" to the sales pipeline!`,
        });
        // Clear form
        setName('');
        setPhone('');
        setContactPerson('');
        setCity('');
        setZipCode('');
        setAddress('');
        setListingUrl('');
        setNotes('');
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to add restaurant. Please try again.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Network error occurred while submitting lead.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Add Restaurant Lead">
      <div className="max-w-2xl mx-auto w-full py-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1">
            New Restaurant Intake
          </h1>
          <p className="text-xs text-muted">
            Add a new restaurant business into the sales pipeline for calling and outreach.
          </p>
        </div>

        {statusMessage && (
          <div
            className={`p-4 rounded-xl mb-6 text-xs font-semibold border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Restaurant / Business Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bella Italia Bistro"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Phone Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (908) 276-6638"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Decision Maker / Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. John Doe (Owner / GM)"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Cranford"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. New Jersey"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Zip Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 07016"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                YellowPages / Listing URL
              </label>
              <input
                type="url"
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder="https://www.yellowpagesonline.com/..."
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Full Address / Location
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 1 Walnut Ave, Cranford, NJ 07016, United States"
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Initial Notes / Background Info
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any known details, cuisine type, key challenges..."
                rows={4}
                className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {isSubmitting ? 'Adding...' : 'Add Restaurant to Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

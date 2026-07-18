'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell';

export default function DataEntry() {
  const [countryCode, setCountryCode] = useState('+92');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lead, setLead] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    if (countryCode === '+92') {
      // For Pakistan: only allow numbers, must start with 3, and limit to 10 digits
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length === 0 || numbersOnly[0] === '3') {
        setPhoneNumber(numbersOnly.slice(0, 10));
      }
    } else {
      // For other countries: allow any format
      setPhoneNumber(value);
    }
  };

  const isValidPakistanNumber = (number) => {
    return number.length === 10 && number[0] === '3';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate Pakistan phone number
    if (countryCode === '+92' && !isValidPakistanNumber(phoneNumber)) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phoneNumber,
          countryCode,
          lead,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        // Reset form
        setName('');
        setEmail('');
        setPhoneNumber('');
        setLead('');
      } else if (response.status === 409 && data.duplicate) {
        // Handle duplicate phone number
        setSubmitStatus('duplicate');
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendInvoiceLink = (
    <Link
      href="/send-invoice"
      className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg hover:bg-secondary hover:text-on-secondary transition-colors text-label-md"
    >
      <span className="material-symbols-outlined text-[18px]">receipt_long</span>
      Send Invoice
    </Link>
  );

  return (
    <AppShell title="Data Entry" search={sendInvoiceLink}>
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-headline-lg font-bold text-on-surface">DataCrumbs Lead Management</h1>
          <p className="text-on-surface-variant mt-2 text-body-lg">Capture and Track Your Sales Leads</p>
        </div>

        {submitStatus && (
          <div className={`text-center p-4 rounded-lg mb-6 border ${
            submitStatus === 'success'
              ? 'bg-secondary-container/20 text-secondary border-secondary/30'
              : submitStatus === 'duplicate'
              ? 'bg-tertiary-container/20 text-tertiary border-tertiary/30'
              : 'bg-error-container/20 text-error border-error/30'
          }`}>
            {submitStatus === 'success'
              ? '✓ Lead submitted successfully!'
              : submitStatus === 'duplicate'
              ? '⚠ This phone number already exists in the system. Please use a different number.'
              : countryCode === '+92' && !isValidPakistanNumber(phoneNumber)
                ? 'Please enter a valid 10-digit Pakistan number starting with 3'
                : 'Failed to submit lead. Please try again.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-label-sm text-on-surface-variant mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  placeholder="Enter lead's name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-label-sm text-on-surface-variant mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  placeholder="Enter lead's email"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-label-sm text-on-surface-variant mb-1">
                  Phone Number <span className="text-error">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative w-40">
                    <select
                      id="countryCode"
                      className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 outline-none appearance-none"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                        <option value="+92" className="bg-surface-container-high">🇵🇰 Pakistan (+92)</option>
                        <option value="+93" className="bg-surface-container-high">🇦🇫 Afghanistan (+93)</option>
                        <option value="+355" className="bg-surface-container-high">🇦🇱 Albania (+355)</option>
                        <option value="+213" className="bg-surface-container-high">🇩🇿 Algeria (+213)</option>
                        <option value="+376" className="bg-surface-container-high">🇦🇩 Andorra (+376)</option>
                        <option value="+244" className="bg-surface-container-high">🇦🇴 Angola (+244)</option>
                        <option value="+1" className="bg-surface-container-high">🇦🇮 Anguilla (+1)</option>
                        <option value="+1" className="bg-surface-container-high">🇦🇬 Antigua & Barbuda (+1)</option>
                        <option value="+54" className="bg-surface-container-high">🇦🇷 Argentina (+54)</option>
                        <option value="+374" className="bg-surface-container-high">🇦🇲 Armenia (+374)</option>
                        <option value="+297" className="bg-surface-container-high">🇦🇼 Aruba (+297)</option>
                        <option value="+61" className="bg-surface-container-high">🇦🇺 Australia (+61)</option>
                        <option value="+43" className="bg-surface-container-high">🇦🇹 Austria (+43)</option>
                        <option value="+994" className="bg-surface-container-high">🇦🇿 Azerbaijan (+994)</option>
                        <option value="+1" className="bg-surface-container-high">🇧🇸 Bahamas (+1)</option>
                        <option value="+973" className="bg-surface-container-high">🇧🇭 Bahrain (+973)</option>
                        <option value="+880" className="bg-surface-container-high">🇧🇩 Bangladesh (+880)</option>
                        <option value="+1" className="bg-surface-container-high">🇧🇧 Barbados (+1)</option>
                        <option value="+375" className="bg-surface-container-high">🇧🇾 Belarus (+375)</option>
                        <option value="+32" className="bg-surface-container-high">🇧🇪 Belgium (+32)</option>
                        <option value="+501" className="bg-surface-container-high">🇧🇿 Belize (+501)</option>
                        <option value="+229" className="bg-surface-container-high">🇧🇯 Benin (+229)</option>
                        <option value="+1" className="bg-surface-container-high">🇧🇲 Bermuda (+1)</option>
                        <option value="+975" className="bg-surface-container-high">🇧🇹 Bhutan (+975)</option>
                        <option value="+591" className="bg-surface-container-high">🇧🇴 Bolivia (+591)</option>
                        <option value="+387" className="bg-surface-container-high">🇧🇦 Bosnia & Herzegovina (+387)</option>
                        <option value="+267" className="bg-surface-container-high">🇧🇼 Botswana (+267)</option>
                        <option value="+55" className="bg-surface-container-high">🇧🇷 Brazil (+55)</option>
                        <option value="+1" className="bg-surface-container-high">🇻🇬 British Virgin Islands (+1)</option>
                        <option value="+673" className="bg-surface-container-high">🇧🇳 Brunei (+673)</option>
                        <option value="+359" className="bg-surface-container-high">🇧🇬 Bulgaria (+359)</option>
                        <option value="+226" className="bg-surface-container-high">🇧🇫 Burkina Faso (+226)</option>
                        <option value="+257" className="bg-surface-container-high">🇧🇮 Burundi (+257)</option>
                        <option value="+855" className="bg-surface-container-high">🇰🇭 Cambodia (+855)</option>
                        <option value="+237" className="bg-surface-container-high">🇨🇲 Cameroon (+237)</option>
                        <option value="+1" className="bg-surface-container-high">🇨🇦 Canada (+1)</option>
                        <option value="+238" className="bg-surface-container-high">🇨🇻 Cape Verde (+238)</option>
                        <option value="+1" className="bg-surface-container-high">🇰🇾 Cayman Islands (+1)</option>
                        <option value="+236" className="bg-surface-container-high">🇨🇫 Central African Republic (+236)</option>
                        <option value="+235" className="bg-surface-container-high">🇹🇩 Chad (+235)</option>
                        <option value="+56" className="bg-surface-container-high">🇨🇱 Chile (+56)</option>
                        <option value="+86" className="bg-surface-container-high">🇨🇳 China (+86)</option>
                        <option value="+57" className="bg-surface-container-high">🇨🇴 Colombia (+57)</option>
                        <option value="+269" className="bg-surface-container-high">🇰🇲 Comoros (+269)</option>
                        <option value="+242" className="bg-surface-container-high">🇨🇬 Congo (+242)</option>
                        <option value="+682" className="bg-surface-container-high">🇨🇰 Cook Islands (+682)</option>
                        <option value="+506" className="bg-surface-container-high">🇨🇷 Costa Rica (+506)</option>
                        <option value="+385" className="bg-surface-container-high">🇭🇷 Croatia (+385)</option>
                        <option value="+53" className="bg-surface-container-high">🇨🇺 Cuba (+53)</option>
                        <option value="+357" className="bg-surface-container-high">🇨🇾 Cyprus (+357)</option>
                        <option value="+420" className="bg-surface-container-high">🇨🇿 Czech Republic (+420)</option>
                        <option value="+45" className="bg-surface-container-high">🇩🇰 Denmark (+45)</option>
                        <option value="+253" className="bg-surface-container-high">🇩🇯 Djibouti (+253)</option>
                        <option value="+1" className="bg-surface-container-high">🇩🇲 Dominica (+1)</option>
                        <option value="+1" className="bg-surface-container-high">🇩🇴 Dominican Republic (+1)</option>
                        <option value="+593" className="bg-surface-container-high">🇪🇨 Ecuador (+593)</option>
                        <option value="+20" className="bg-surface-container-high">🇪🇬 Egypt (+20)</option>
                        <option value="+503" className="bg-surface-container-high">🇸🇻 El Salvador (+503)</option>
                        <option value="+240" className="bg-surface-container-high">🇬🇶 Equatorial Guinea (+240)</option>
                        <option value="+291" className="bg-surface-container-high">🇪🇷 Eritrea (+291)</option>
                        <option value="+372" className="bg-surface-container-high">🇪🇪 Estonia (+372)</option>
                        <option value="+251" className="bg-surface-container-high">🇪🇹 Ethiopia (+251)</option>
                        <option value="+500" className="bg-surface-container-high">🇫🇰 Falkland Islands (+500)</option>
                        <option value="+298" className="bg-surface-container-high">🇫🇴 Faroe Islands (+298)</option>
                        <option value="+679" className="bg-surface-container-high">🇫🇯 Fiji (+679)</option>
                        <option value="+358" className="bg-surface-container-high">🇫🇮 Finland (+358)</option>
                        <option value="+33" className="bg-surface-container-high">🇫🇷 France (+33)</option>
                        <option value="+594" className="bg-surface-container-high">🇬🇫 French Guiana (+594)</option>
                        <option value="+689" className="bg-surface-container-high">🇵🇫 French Polynesia (+689)</option>
                        <option value="+241" className="bg-surface-container-high">🇬🇦 Gabon (+241)</option>
                        <option value="+220" className="bg-surface-container-high">🇬🇲 Gambia (+220)</option>
                        <option value="+995" className="bg-surface-container-high">🇬🇪 Georgia (+995)</option>
                        <option value="+49" className="bg-surface-container-high">🇩🇪 Germany (+49)</option>
                        <option value="+233" className="bg-surface-container-high">🇬🇭 Ghana (+233)</option>
                        <option value="+350" className="bg-surface-container-high">🇬🇮 Gibraltar (+350)</option>
                        <option value="+30" className="bg-surface-container-high">🇬🇷 Greece (+30)</option>
                        <option value="+299" className="bg-surface-container-high">🇬🇱 Greenland (+299)</option>
                        <option value="+1" className="bg-surface-container-high">🇬🇩 Grenada (+1)</option>
                        <option value="+590" className="bg-surface-container-high">🇬🇵 Guadeloupe (+590)</option>
                        <option value="+1" className="bg-surface-container-high">🇬🇺 Guam (+1)</option>
                        <option value="+502" className="bg-surface-container-high">🇬🇹 Guatemala (+502)</option>
                        <option value="+224" className="bg-surface-container-high">🇬🇳 Guinea (+224)</option>
                        <option value="+245" className="bg-surface-container-high">🇬🇼 Guinea-Bissau (+245)</option>
                        <option value="+592" className="bg-surface-container-high">🇬🇾 Guyana (+592)</option>
                        <option value="+509" className="bg-surface-container-high">🇭🇹 Haiti (+509)</option>
                        <option value="+504" className="bg-surface-container-high">🇭🇳 Honduras (+504)</option>
                        <option value="+852" className="bg-surface-container-high">🇭🇰 Hong Kong (+852)</option>
                        <option value="+36" className="bg-surface-container-high">🇭🇺 Hungary (+36)</option>
                        <option value="+354" className="bg-surface-container-high">🇮🇸 Iceland (+354)</option>
                        <option value="+91" className="bg-surface-container-high">🇮🇳 India (+91)</option>
                        <option value="+62" className="bg-surface-container-high">🇮🇩 Indonesia (+62)</option>
                        <option value="+98" className="bg-surface-container-high">🇮🇷 Iran (+98)</option>
                        <option value="+964" className="bg-surface-container-high">🇮🇶 Iraq (+964)</option>
                        <option value="+353" className="bg-surface-container-high">🇮🇪 Ireland (+353)</option>
                        <option value="+972" className="bg-surface-container-high">🇮🇱 Israel (+972)</option>
                        <option value="+39" className="bg-surface-container-high">🇮🇹 Italy (+39)</option>
                        <option value="+1" className="bg-surface-container-high">🇯🇲 Jamaica (+1)</option>
                        <option value="+81" className="bg-surface-container-high">🇯🇵 Japan (+81)</option>
                        <option value="+962" className="bg-surface-container-high">🇯🇴 Jordan (+962)</option>
                        <option value="+7" className="bg-surface-container-high">🇰🇿 Kazakhstan (+7)</option>
                        <option value="+254" className="bg-surface-container-high">🇰🇪 Kenya (+254)</option>
                        <option value="+686" className="bg-surface-container-high">🇰🇮 Kiribati (+686)</option>
                        <option value="+965" className="bg-surface-container-high">🇰🇼 Kuwait (+965)</option>
                        <option value="+996" className="bg-surface-container-high">🇰🇬 Kyrgyzstan (+996)</option>
                        <option value="+856" className="bg-surface-container-high">🇱🇦 Laos (+856)</option>
                        <option value="+371" className="bg-surface-container-high">🇱🇻 Latvia (+371)</option>
                        <option value="+961" className="bg-surface-container-high">🇱🇧 Lebanon (+961)</option>
                        <option value="+266" className="bg-surface-container-high">🇱🇸 Lesotho (+266)</option>
                        <option value="+231" className="bg-surface-container-high">🇱🇷 Liberia (+231)</option>
                        <option value="+218" className="bg-surface-container-high">🇱🇾 Libya (+218)</option>
                        <option value="+423" className="bg-surface-container-high">🇱🇮 Liechtenstein (+423)</option>
                        <option value="+370" className="bg-surface-container-high">🇱🇹 Lithuania (+370)</option>
                        <option value="+352" className="bg-surface-container-high">🇱🇺 Luxembourg (+352)</option>
                        <option value="+853" className="bg-surface-container-high">🇲🇴 Macau (+853)</option>
                        <option value="+389" className="bg-surface-container-high">🇲🇰 Macedonia (+389)</option>
                        <option value="+261" className="bg-surface-container-high">🇲🇬 Madagascar (+261)</option>
                        <option value="+265" className="bg-surface-container-high">🇲🇼 Malawi (+265)</option>
                        <option value="+60" className="bg-surface-container-high">🇲🇾 Malaysia (+60)</option>
                        <option value="+960" className="bg-surface-container-high">🇲🇻 Maldives (+960)</option>
                        <option value="+223" className="bg-surface-container-high">🇲🇱 Mali (+223)</option>
                        <option value="+356" className="bg-surface-container-high">🇲🇹 Malta (+356)</option>
                        <option value="+692" className="bg-surface-container-high">🇲🇭 Marshall Islands (+692)</option>
                        <option value="+596" className="bg-surface-container-high">🇲🇶 Martinique (+596)</option>
                        <option value="+222" className="bg-surface-container-high">🇲🇷 Mauritania (+222)</option>
                        <option value="+230" className="bg-surface-container-high">🇲🇺 Mauritius (+230)</option>
                        <option value="+52" className="bg-surface-container-high">🇲🇽 Mexico (+52)</option>
                        <option value="+691" className="bg-surface-container-high">🇫🇲 Micronesia (+691)</option>
                        <option value="+373" className="bg-surface-container-high">🇲🇩 Moldova (+373)</option>
                        <option value="+377" className="bg-surface-container-high">🇲🇨 Monaco (+377)</option>
                        <option value="+976" className="bg-surface-container-high">🇲🇳 Mongolia (+976)</option>
                        <option value="+382" className="bg-surface-container-high">🇲🇪 Montenegro (+382)</option>
                        <option value="+1" className="bg-surface-container-high">🇲🇸 Montserrat (+1)</option>
                        <option value="+212" className="bg-surface-container-high">🇲🇦 Morocco (+212)</option>
                        <option value="+258" className="bg-surface-container-high">🇲🇿 Mozambique (+258)</option>
                        <option value="+95" className="bg-surface-container-high">🇲🇲 Myanmar (+95)</option>
                        <option value="+264" className="bg-surface-container-high">🇳🇦 Namibia (+264)</option>
                        <option value="+674" className="bg-surface-container-high">🇳🇷 Nauru (+674)</option>
                        <option value="+977" className="bg-surface-container-high">🇳🇵 Nepal (+977)</option>
                        <option value="+31" className="bg-surface-container-high">🇳🇱 Netherlands (+31)</option>
                        <option value="+687" className="bg-surface-container-high">🇳🇨 New Caledonia (+687)</option>
                        <option value="+64" className="bg-surface-container-high">🇳🇿 New Zealand (+64)</option>
                        <option value="+505" className="bg-surface-container-high">🇳🇮 Nicaragua (+505)</option>
                        <option value="+227" className="bg-surface-container-high">🇳🇪 Niger (+227)</option>
                        <option value="+234" className="bg-surface-container-high">🇳🇬 Nigeria (+234)</option>
                        <option value="+683" className="bg-surface-container-high">🇳🇺 Niue (+683)</option>
                        <option value="+672" className="bg-surface-container-high">🇳🇫 Norfolk Island (+672)</option>
                        <option value="+850" className="bg-surface-container-high">🇰🇵 North Korea (+850)</option>
                        <option value="+1" className="bg-surface-container-high">🇲🇵 Northern Mariana Islands (+1)</option>
                        <option value="+47" className="bg-surface-container-high">🇳🇴 Norway (+47)</option>
                        <option value="+968" className="bg-surface-container-high">🇴🇲 Oman (+968)</option>
                        <option value="+680" className="bg-surface-container-high">🇵🇼 Palau (+680)</option>
                        <option value="+970" className="bg-surface-container-high">🇵🇸 Palestine (+970)</option>
                        <option value="+507" className="bg-surface-container-high">🇵🇦 Panama (+507)</option>
                        <option value="+675" className="bg-surface-container-high">🇵🇬 Papua New Guinea (+675)</option>
                        <option value="+595" className="bg-surface-container-high">🇵🇾 Paraguay (+595)</option>
                        <option value="+51" className="bg-surface-container-high">🇵🇪 Peru (+51)</option>
                        <option value="+63" className="bg-surface-container-high">🇵🇭 Philippines (+63)</option>
                        <option value="+48" className="bg-surface-container-high">🇵🇱 Poland (+48)</option>
                        <option value="+351" className="bg-surface-container-high">🇵🇹 Portugal (+351)</option>
                        <option value="+1" className="bg-surface-container-high">🇵🇷 Puerto Rico (+1)</option>
                        <option value="+974" className="bg-surface-container-high">🇶🇦 Qatar (+974)</option>
                        <option value="+236" className="bg-surface-container-high">🇨🇫 Republic of the Congo (+236)</option>
                        <option value="+40" className="bg-surface-container-high">🇷🇴 Romania (+40)</option>
                        <option value="+7" className="bg-surface-container-high">🇷🇺 Russia (+7)</option>
                        <option value="+250" className="bg-surface-container-high">🇷🇼 Rwanda (+250)</option>
                        <option value="+590" className="bg-surface-container-high">🇧🇱 Saint Barthélemy (+590)</option>
                        <option value="+290" className="bg-surface-container-high">🇸🇭 Saint Helena (+290)</option>
                        <option value="+1" className="bg-surface-container-high">🇰🇳 Saint Kitts and Nevis (+1)</option>
                        <option value="+1" className="bg-surface-container-high">🇱🇨 Saint Lucia (+1)</option>
                        <option value="+590" className="bg-surface-container-high">🇲🇫 Saint Martin (+590)</option>
                        <option value="+508" className="bg-surface-container-high">🇵🇲 Saint Pierre and Miquelon (+508)</option>
                        <option value="+1" className="bg-surface-container-high">🇻🇨 Saint Vincent and the Grenadines (+1)</option>
                        <option value="+685" className="bg-surface-container-high">🇼🇸 Samoa (+685)</option>
                        <option value="+378" className="bg-surface-container-high">🇸🇲 San Marino (+378)</option>
                        <option value="+239" className="bg-surface-container-high">🇸🇹 São Tomé and Príncipe (+239)</option>
                        <option value="+966" className="bg-surface-container-high">🇸🇦 Saudi Arabia (+966)</option>
                        <option value="+221" className="bg-surface-container-high">🇸🇳 Senegal (+221)</option>
                        <option value="+381" className="bg-surface-container-high">🇷🇸 Serbia (+381)</option>
                        <option value="+248" className="bg-surface-container-high">🇸🇨 Seychelles (+248)</option>
                        <option value="+232" className="bg-surface-container-high">🇸🇱 Sierra Leone (+232)</option>
                        <option value="+65" className="bg-surface-container-high">🇸🇬 Singapore (+65)</option>
                        <option value="+1" className="bg-surface-container-high">🇸🇽 Sint Maarten (+1)</option>
                        <option value="+421" className="bg-surface-container-high">🇸🇰 Slovakia (+421)</option>
                        <option value="+386" className="bg-surface-container-high">🇸🇮 Slovenia (+386)</option>
                        <option value="+677" className="bg-surface-container-high">🇸🇧 Solomon Islands (+677)</option>
                        <option value="+252" className="bg-surface-container-high">🇸🇴 Somalia (+252)</option>
                        <option value="+27" className="bg-surface-container-high">🇿🇦 South Africa (+27)</option>
                        <option value="+82" className="bg-surface-container-high">🇰🇷 South Korea (+82)</option>
                        <option value="+211" className="bg-surface-container-high">🇸🇸 South Sudan (+211)</option>
                        <option value="+34" className="bg-surface-container-high">🇪🇸 Spain (+34)</option>
                        <option value="+94" className="bg-surface-container-high">🇱🇰 Sri Lanka (+94)</option>
                        <option value="+249" className="bg-surface-container-high">🇸🇩 Sudan (+249)</option>
                        <option value="+597" className="bg-surface-container-high">🇸🇷 Suriname (+597)</option>
                        <option value="+47" className="bg-surface-container-high">🇸🇯 Svalbard and Jan Mayen (+47)</option>
                        <option value="+268" className="bg-surface-container-high">🇸🇿 Swaziland (+268)</option>
                        <option value="+46" className="bg-surface-container-high">🇸🇪 Sweden (+46)</option>
                        <option value="+41" className="bg-surface-container-high">🇨🇭 Switzerland (+41)</option>
                        <option value="+963" className="bg-surface-container-high">🇸🇾 Syria (+963)</option>
                        <option value="+886" className="bg-surface-container-high">🇹🇼 Taiwan (+886)</option>
                        <option value="+992" className="bg-surface-container-high">🇹🇯 Tajikistan (+992)</option>
                        <option value="+255" className="bg-surface-container-high">🇹🇿 Tanzania (+255)</option>
                        <option value="+66" className="bg-surface-container-high">🇹🇭 Thailand (+66)</option>
                        <option value="+670" className="bg-surface-container-high">🇹🇱 Timor-Leste (+670)</option>
                        <option value="+228" className="bg-surface-container-high">🇹🇬 Togo (+228)</option>
                        <option value="+690" className="bg-surface-container-high">🇹🇰 Tokelau (+690)</option>
                        <option value="+676" className="bg-surface-container-high">🇹🇴 Tonga (+676)</option>
                        <option value="+1" className="bg-surface-container-high">🇹🇹 Trinidad and Tobago (+1)</option>
                        <option value="+216" className="bg-surface-container-high">🇹🇳 Tunisia (+216)</option>
                        <option value="+90" className="bg-surface-container-high">🇹🇷 Turkey (+90)</option>
                        <option value="+993" className="bg-surface-container-high">🇹🇲 Turkmenistan (+993)</option>
                        <option value="+1" className="bg-surface-container-high">🇹🇨 Turks and Caicos Islands (+1)</option>
                        <option value="+688" className="bg-surface-container-high">🇹🇻 Tuvalu (+688)</option>
                        <option value="+1" className="bg-surface-container-high">🇻🇮 U.S. Virgin Islands (+1)</option>
                        <option value="+256" className="bg-surface-container-high">🇺🇬 Uganda (+256)</option>
                        <option value="+380" className="bg-surface-container-high">🇺🇦 Ukraine (+380)</option>
                        <option value="+971" className="bg-surface-container-high">🇦🇪 United Arab Emirates (+971)</option>
                        <option value="+44" className="bg-surface-container-high">🇬🇧 United Kingdom (+44)</option>
                        <option value="+1" className="bg-surface-container-high">🇺🇸 United States (+1)</option>
                        <option value="+598" className="bg-surface-container-high">🇺🇾 Uruguay (+598)</option>
                        <option value="+998" className="bg-surface-container-high">🇺🇿 Uzbekistan (+998)</option>
                        <option value="+678" className="bg-surface-container-high">🇻🇺 Vanuatu (+678)</option>
                        <option value="+379" className="bg-surface-container-high">🇻🇦 Vatican City (+379)</option>
                        <option value="+58" className="bg-surface-container-high">🇻🇪 Venezuela (+58)</option>
                        <option value="+84" className="bg-surface-container-high">🇻🇳 Vietnam (+84)</option>
                        <option value="+681" className="bg-surface-container-high">🇼🇫 Wallis and Futuna (+681)</option>
                        <option value="+212" className="bg-surface-container-high">🇪🇭 Western Sahara (+212)</option>
                        <option value="+967" className="bg-surface-container-high">🇾🇪 Yemen (+967)</option>
                        <option value="+260" className="bg-surface-container-high">🇿🇲 Zambia (+260)</option>
                        <option value="+263" className="bg-surface-container-high">🇿🇼 Zimbabwe (+263)</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">expand_more</span>
                      </div>
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      required
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className={`flex-1 p-2.5 bg-surface-container-high border ${
                        countryCode === '+92' && phoneNumber.length > 0 && !isValidPakistanNumber(phoneNumber)
                          ? 'border-error'
                          : 'border-outline-variant'
                      } rounded-lg text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 outline-none`}
                      placeholder={countryCode === '+92' ? '3XX XXXXXXX' : 'Enter phone number'}
                    />
                  </div>
                  <p className="text-label-sm text-on-surface-variant mt-1.5">
                    {countryCode === '+92' ? 'Enter 10-digit mobile number starting with 3' : 'Enter phone number'}
                  </p>
                </div>

                <div>
                  <label htmlFor="lead" className="block text-label-sm text-on-surface-variant mb-1">
                    Lead Owner <span className="text-error">*</span>
                  </label>
                  <select
                    id="lead"
                    required
                    value={lead}
                    onChange={(e) => setLead(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  >
                    <option value="" className="bg-surface-container-high">Select Lead Owner</option>
                    <option value="pretty" className="bg-surface-container-high">Pretty</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isSubmitting || (countryCode === '+92' && !isValidPakistanNumber(phoneNumber))}
                className={`w-full sm:w-96 px-6 py-3 bg-primary text-on-primary rounded-lg transition-all duration-200 shadow-lg text-body-lg font-medium ${
                  isSubmitting || (countryCode === '+92' && !isValidPakistanNumber(phoneNumber))
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-primary-fixed'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Lead'}
              </button>
            </div>
          </form>
        </div>
    </AppShell>
  );
}

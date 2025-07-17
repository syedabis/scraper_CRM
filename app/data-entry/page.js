'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DataEntry() {
  const router = useRouter();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="min-h-screen p-6 relative">
        {/* Send Invoice Button - Absolute positioned at top left */}
        <div className="absolute top-6 left-6 z-10">
          <a
            href="https://payslipsdatacrumbs-87c5a52d19c0.herokuapp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-green-500/20 transition-all duration-300 hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-medium text-green-400">Send Invoice</span>
          </a>
        </div>

        {/* Navigation Button - Absolute positioned at top right */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={() => router.push('/calling')}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="font-medium text-purple-400">Go to Calling Interface</span>
          </button>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              DataCrumbs Lead Management
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Capture and Track Your Sales Leads</p>
            <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-3 rounded-full"></div>
          </div>
          
          {submitStatus && (
            <div className={`text-center p-4 rounded-lg mb-6 ${
              submitStatus === 'success' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/20' 
                : submitStatus === 'duplicate'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'
                : 'bg-red-500/20 text-red-400 border border-red-500/20'
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
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-lg">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter lead's name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter lead's email"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                    Phone Number <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-40">
                      <select
                        id="countryCode"
                        className="w-full p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                      >
                        <option value="+92" className="bg-gray-800">🇵🇰 Pakistan (+92)</option>
                        <option value="+93" className="bg-gray-800">🇦🇫 Afghanistan (+93)</option>
                        <option value="+355" className="bg-gray-800">🇦🇱 Albania (+355)</option>
                        <option value="+213" className="bg-gray-800">🇩🇿 Algeria (+213)</option>
                        <option value="+376" className="bg-gray-800">🇦🇩 Andorra (+376)</option>
                        <option value="+244" className="bg-gray-800">🇦🇴 Angola (+244)</option>
                        <option value="+1" className="bg-gray-800">🇦🇮 Anguilla (+1)</option>
                        <option value="+1" className="bg-gray-800">🇦🇬 Antigua & Barbuda (+1)</option>
                        <option value="+54" className="bg-gray-800">🇦🇷 Argentina (+54)</option>
                        <option value="+374" className="bg-gray-800">🇦🇲 Armenia (+374)</option>
                        <option value="+297" className="bg-gray-800">🇦🇼 Aruba (+297)</option>
                        <option value="+61" className="bg-gray-800">🇦🇺 Australia (+61)</option>
                        <option value="+43" className="bg-gray-800">🇦🇹 Austria (+43)</option>
                        <option value="+994" className="bg-gray-800">🇦🇿 Azerbaijan (+994)</option>
                        <option value="+1" className="bg-gray-800">🇧🇸 Bahamas (+1)</option>
                        <option value="+973" className="bg-gray-800">🇧🇭 Bahrain (+973)</option>
                        <option value="+880" className="bg-gray-800">🇧🇩 Bangladesh (+880)</option>
                        <option value="+1" className="bg-gray-800">🇧🇧 Barbados (+1)</option>
                        <option value="+375" className="bg-gray-800">🇧🇾 Belarus (+375)</option>
                        <option value="+32" className="bg-gray-800">🇧🇪 Belgium (+32)</option>
                        <option value="+501" className="bg-gray-800">🇧🇿 Belize (+501)</option>
                        <option value="+229" className="bg-gray-800">🇧🇯 Benin (+229)</option>
                        <option value="+1" className="bg-gray-800">🇧🇲 Bermuda (+1)</option>
                        <option value="+975" className="bg-gray-800">🇧🇹 Bhutan (+975)</option>
                        <option value="+591" className="bg-gray-800">🇧🇴 Bolivia (+591)</option>
                        <option value="+387" className="bg-gray-800">🇧🇦 Bosnia & Herzegovina (+387)</option>
                        <option value="+267" className="bg-gray-800">🇧🇼 Botswana (+267)</option>
                        <option value="+55" className="bg-gray-800">🇧🇷 Brazil (+55)</option>
                        <option value="+1" className="bg-gray-800">🇻🇬 British Virgin Islands (+1)</option>
                        <option value="+673" className="bg-gray-800">🇧🇳 Brunei (+673)</option>
                        <option value="+359" className="bg-gray-800">🇧🇬 Bulgaria (+359)</option>
                        <option value="+226" className="bg-gray-800">🇧🇫 Burkina Faso (+226)</option>
                        <option value="+257" className="bg-gray-800">🇧🇮 Burundi (+257)</option>
                        <option value="+855" className="bg-gray-800">🇰🇭 Cambodia (+855)</option>
                        <option value="+237" className="bg-gray-800">🇨🇲 Cameroon (+237)</option>
                        <option value="+1" className="bg-gray-800">🇨🇦 Canada (+1)</option>
                        <option value="+238" className="bg-gray-800">🇨🇻 Cape Verde (+238)</option>
                        <option value="+1" className="bg-gray-800">🇰🇾 Cayman Islands (+1)</option>
                        <option value="+236" className="bg-gray-800">🇨🇫 Central African Republic (+236)</option>
                        <option value="+235" className="bg-gray-800">🇹🇩 Chad (+235)</option>
                        <option value="+56" className="bg-gray-800">🇨🇱 Chile (+56)</option>
                        <option value="+86" className="bg-gray-800">🇨🇳 China (+86)</option>
                        <option value="+57" className="bg-gray-800">🇨🇴 Colombia (+57)</option>
                        <option value="+269" className="bg-gray-800">🇰🇲 Comoros (+269)</option>
                        <option value="+242" className="bg-gray-800">🇨🇬 Congo (+242)</option>
                        <option value="+682" className="bg-gray-800">🇨🇰 Cook Islands (+682)</option>
                        <option value="+506" className="bg-gray-800">🇨🇷 Costa Rica (+506)</option>
                        <option value="+385" className="bg-gray-800">🇭🇷 Croatia (+385)</option>
                        <option value="+53" className="bg-gray-800">🇨🇺 Cuba (+53)</option>
                        <option value="+357" className="bg-gray-800">🇨🇾 Cyprus (+357)</option>
                        <option value="+420" className="bg-gray-800">🇨🇿 Czech Republic (+420)</option>
                        <option value="+45" className="bg-gray-800">🇩🇰 Denmark (+45)</option>
                        <option value="+253" className="bg-gray-800">🇩🇯 Djibouti (+253)</option>
                        <option value="+1" className="bg-gray-800">🇩🇲 Dominica (+1)</option>
                        <option value="+1" className="bg-gray-800">🇩🇴 Dominican Republic (+1)</option>
                        <option value="+593" className="bg-gray-800">🇪🇨 Ecuador (+593)</option>
                        <option value="+20" className="bg-gray-800">🇪🇬 Egypt (+20)</option>
                        <option value="+503" className="bg-gray-800">🇸🇻 El Salvador (+503)</option>
                        <option value="+240" className="bg-gray-800">🇬🇶 Equatorial Guinea (+240)</option>
                        <option value="+291" className="bg-gray-800">🇪🇷 Eritrea (+291)</option>
                        <option value="+372" className="bg-gray-800">🇪🇪 Estonia (+372)</option>
                        <option value="+251" className="bg-gray-800">🇪🇹 Ethiopia (+251)</option>
                        <option value="+500" className="bg-gray-800">🇫🇰 Falkland Islands (+500)</option>
                        <option value="+298" className="bg-gray-800">🇫🇴 Faroe Islands (+298)</option>
                        <option value="+679" className="bg-gray-800">🇫🇯 Fiji (+679)</option>
                        <option value="+358" className="bg-gray-800">🇫🇮 Finland (+358)</option>
                        <option value="+33" className="bg-gray-800">🇫🇷 France (+33)</option>
                        <option value="+594" className="bg-gray-800">🇬🇫 French Guiana (+594)</option>
                        <option value="+689" className="bg-gray-800">🇵🇫 French Polynesia (+689)</option>
                        <option value="+241" className="bg-gray-800">🇬🇦 Gabon (+241)</option>
                        <option value="+220" className="bg-gray-800">🇬🇲 Gambia (+220)</option>
                        <option value="+995" className="bg-gray-800">🇬🇪 Georgia (+995)</option>
                        <option value="+49" className="bg-gray-800">🇩🇪 Germany (+49)</option>
                        <option value="+233" className="bg-gray-800">🇬🇭 Ghana (+233)</option>
                        <option value="+350" className="bg-gray-800">🇬🇮 Gibraltar (+350)</option>
                        <option value="+30" className="bg-gray-800">🇬🇷 Greece (+30)</option>
                        <option value="+299" className="bg-gray-800">🇬🇱 Greenland (+299)</option>
                        <option value="+1" className="bg-gray-800">🇬🇩 Grenada (+1)</option>
                        <option value="+590" className="bg-gray-800">🇬🇵 Guadeloupe (+590)</option>
                        <option value="+1" className="bg-gray-800">🇬🇺 Guam (+1)</option>
                        <option value="+502" className="bg-gray-800">🇬🇹 Guatemala (+502)</option>
                        <option value="+224" className="bg-gray-800">🇬🇳 Guinea (+224)</option>
                        <option value="+245" className="bg-gray-800">🇬🇼 Guinea-Bissau (+245)</option>
                        <option value="+592" className="bg-gray-800">🇬🇾 Guyana (+592)</option>
                        <option value="+509" className="bg-gray-800">🇭🇹 Haiti (+509)</option>
                        <option value="+504" className="bg-gray-800">🇭🇳 Honduras (+504)</option>
                        <option value="+852" className="bg-gray-800">🇭🇰 Hong Kong (+852)</option>
                        <option value="+36" className="bg-gray-800">🇭🇺 Hungary (+36)</option>
                        <option value="+354" className="bg-gray-800">🇮🇸 Iceland (+354)</option>
                        <option value="+91" className="bg-gray-800">🇮🇳 India (+91)</option>
                        <option value="+62" className="bg-gray-800">🇮🇩 Indonesia (+62)</option>
                        <option value="+98" className="bg-gray-800">🇮🇷 Iran (+98)</option>
                        <option value="+964" className="bg-gray-800">🇮🇶 Iraq (+964)</option>
                        <option value="+353" className="bg-gray-800">🇮🇪 Ireland (+353)</option>
                        <option value="+972" className="bg-gray-800">🇮🇱 Israel (+972)</option>
                        <option value="+39" className="bg-gray-800">🇮🇹 Italy (+39)</option>
                        <option value="+1" className="bg-gray-800">🇯🇲 Jamaica (+1)</option>
                        <option value="+81" className="bg-gray-800">🇯🇵 Japan (+81)</option>
                        <option value="+962" className="bg-gray-800">🇯🇴 Jordan (+962)</option>
                        <option value="+7" className="bg-gray-800">🇰🇿 Kazakhstan (+7)</option>
                        <option value="+254" className="bg-gray-800">🇰🇪 Kenya (+254)</option>
                        <option value="+686" className="bg-gray-800">🇰🇮 Kiribati (+686)</option>
                        <option value="+965" className="bg-gray-800">🇰🇼 Kuwait (+965)</option>
                        <option value="+996" className="bg-gray-800">🇰🇬 Kyrgyzstan (+996)</option>
                        <option value="+856" className="bg-gray-800">🇱🇦 Laos (+856)</option>
                        <option value="+371" className="bg-gray-800">🇱🇻 Latvia (+371)</option>
                        <option value="+961" className="bg-gray-800">🇱🇧 Lebanon (+961)</option>
                        <option value="+266" className="bg-gray-800">🇱🇸 Lesotho (+266)</option>
                        <option value="+231" className="bg-gray-800">🇱🇷 Liberia (+231)</option>
                        <option value="+218" className="bg-gray-800">🇱🇾 Libya (+218)</option>
                        <option value="+423" className="bg-gray-800">🇱🇮 Liechtenstein (+423)</option>
                        <option value="+370" className="bg-gray-800">🇱🇹 Lithuania (+370)</option>
                        <option value="+352" className="bg-gray-800">🇱🇺 Luxembourg (+352)</option>
                        <option value="+853" className="bg-gray-800">🇲🇴 Macau (+853)</option>
                        <option value="+389" className="bg-gray-800">🇲🇰 Macedonia (+389)</option>
                        <option value="+261" className="bg-gray-800">🇲🇬 Madagascar (+261)</option>
                        <option value="+265" className="bg-gray-800">🇲🇼 Malawi (+265)</option>
                        <option value="+60" className="bg-gray-800">🇲🇾 Malaysia (+60)</option>
                        <option value="+960" className="bg-gray-800">🇲🇻 Maldives (+960)</option>
                        <option value="+223" className="bg-gray-800">🇲🇱 Mali (+223)</option>
                        <option value="+356" className="bg-gray-800">🇲🇹 Malta (+356)</option>
                        <option value="+692" className="bg-gray-800">🇲🇭 Marshall Islands (+692)</option>
                        <option value="+596" className="bg-gray-800">🇲🇶 Martinique (+596)</option>
                        <option value="+222" className="bg-gray-800">🇲🇷 Mauritania (+222)</option>
                        <option value="+230" className="bg-gray-800">🇲🇺 Mauritius (+230)</option>
                        <option value="+52" className="bg-gray-800">🇲🇽 Mexico (+52)</option>
                        <option value="+691" className="bg-gray-800">🇫🇲 Micronesia (+691)</option>
                        <option value="+373" className="bg-gray-800">🇲🇩 Moldova (+373)</option>
                        <option value="+377" className="bg-gray-800">🇲🇨 Monaco (+377)</option>
                        <option value="+976" className="bg-gray-800">🇲🇳 Mongolia (+976)</option>
                        <option value="+382" className="bg-gray-800">🇲🇪 Montenegro (+382)</option>
                        <option value="+1" className="bg-gray-800">🇲🇸 Montserrat (+1)</option>
                        <option value="+212" className="bg-gray-800">🇲🇦 Morocco (+212)</option>
                        <option value="+258" className="bg-gray-800">🇲🇿 Mozambique (+258)</option>
                        <option value="+95" className="bg-gray-800">🇲🇲 Myanmar (+95)</option>
                        <option value="+264" className="bg-gray-800">🇳🇦 Namibia (+264)</option>
                        <option value="+674" className="bg-gray-800">🇳🇷 Nauru (+674)</option>
                        <option value="+977" className="bg-gray-800">🇳🇵 Nepal (+977)</option>
                        <option value="+31" className="bg-gray-800">🇳🇱 Netherlands (+31)</option>
                        <option value="+687" className="bg-gray-800">🇳🇨 New Caledonia (+687)</option>
                        <option value="+64" className="bg-gray-800">🇳🇿 New Zealand (+64)</option>
                        <option value="+505" className="bg-gray-800">🇳🇮 Nicaragua (+505)</option>
                        <option value="+227" className="bg-gray-800">🇳🇪 Niger (+227)</option>
                        <option value="+234" className="bg-gray-800">🇳🇬 Nigeria (+234)</option>
                        <option value="+683" className="bg-gray-800">🇳🇺 Niue (+683)</option>
                        <option value="+672" className="bg-gray-800">🇳🇫 Norfolk Island (+672)</option>
                        <option value="+850" className="bg-gray-800">🇰🇵 North Korea (+850)</option>
                        <option value="+1" className="bg-gray-800">🇲🇵 Northern Mariana Islands (+1)</option>
                        <option value="+47" className="bg-gray-800">🇳🇴 Norway (+47)</option>
                        <option value="+968" className="bg-gray-800">🇴🇲 Oman (+968)</option>
                        <option value="+680" className="bg-gray-800">🇵🇼 Palau (+680)</option>
                        <option value="+970" className="bg-gray-800">🇵🇸 Palestine (+970)</option>
                        <option value="+507" className="bg-gray-800">🇵🇦 Panama (+507)</option>
                        <option value="+675" className="bg-gray-800">🇵🇬 Papua New Guinea (+675)</option>
                        <option value="+595" className="bg-gray-800">🇵🇾 Paraguay (+595)</option>
                        <option value="+51" className="bg-gray-800">🇵🇪 Peru (+51)</option>
                        <option value="+63" className="bg-gray-800">🇵🇭 Philippines (+63)</option>
                        <option value="+48" className="bg-gray-800">🇵🇱 Poland (+48)</option>
                        <option value="+351" className="bg-gray-800">🇵🇹 Portugal (+351)</option>
                        <option value="+1" className="bg-gray-800">🇵🇷 Puerto Rico (+1)</option>
                        <option value="+974" className="bg-gray-800">🇶🇦 Qatar (+974)</option>
                        <option value="+236" className="bg-gray-800">🇨🇫 Republic of the Congo (+236)</option>
                        <option value="+40" className="bg-gray-800">🇷🇴 Romania (+40)</option>
                        <option value="+7" className="bg-gray-800">🇷🇺 Russia (+7)</option>
                        <option value="+250" className="bg-gray-800">🇷🇼 Rwanda (+250)</option>
                        <option value="+590" className="bg-gray-800">🇧🇱 Saint Barthélemy (+590)</option>
                        <option value="+290" className="bg-gray-800">🇸🇭 Saint Helena (+290)</option>
                        <option value="+1" className="bg-gray-800">🇰🇳 Saint Kitts and Nevis (+1)</option>
                        <option value="+1" className="bg-gray-800">🇱🇨 Saint Lucia (+1)</option>
                        <option value="+590" className="bg-gray-800">🇲🇫 Saint Martin (+590)</option>
                        <option value="+508" className="bg-gray-800">🇵🇲 Saint Pierre and Miquelon (+508)</option>
                        <option value="+1" className="bg-gray-800">🇻🇨 Saint Vincent and the Grenadines (+1)</option>
                        <option value="+685" className="bg-gray-800">🇼🇸 Samoa (+685)</option>
                        <option value="+378" className="bg-gray-800">🇸🇲 San Marino (+378)</option>
                        <option value="+239" className="bg-gray-800">🇸🇹 São Tomé and Príncipe (+239)</option>
                        <option value="+966" className="bg-gray-800">🇸🇦 Saudi Arabia (+966)</option>
                        <option value="+221" className="bg-gray-800">🇸🇳 Senegal (+221)</option>
                        <option value="+381" className="bg-gray-800">🇷🇸 Serbia (+381)</option>
                        <option value="+248" className="bg-gray-800">🇸🇨 Seychelles (+248)</option>
                        <option value="+232" className="bg-gray-800">🇸🇱 Sierra Leone (+232)</option>
                        <option value="+65" className="bg-gray-800">🇸🇬 Singapore (+65)</option>
                        <option value="+1" className="bg-gray-800">🇸🇽 Sint Maarten (+1)</option>
                        <option value="+421" className="bg-gray-800">🇸🇰 Slovakia (+421)</option>
                        <option value="+386" className="bg-gray-800">🇸🇮 Slovenia (+386)</option>
                        <option value="+677" className="bg-gray-800">🇸🇧 Solomon Islands (+677)</option>
                        <option value="+252" className="bg-gray-800">🇸🇴 Somalia (+252)</option>
                        <option value="+27" className="bg-gray-800">🇿🇦 South Africa (+27)</option>
                        <option value="+82" className="bg-gray-800">🇰🇷 South Korea (+82)</option>
                        <option value="+211" className="bg-gray-800">🇸🇸 South Sudan (+211)</option>
                        <option value="+34" className="bg-gray-800">🇪🇸 Spain (+34)</option>
                        <option value="+94" className="bg-gray-800">🇱🇰 Sri Lanka (+94)</option>
                        <option value="+249" className="bg-gray-800">🇸🇩 Sudan (+249)</option>
                        <option value="+597" className="bg-gray-800">🇸🇷 Suriname (+597)</option>
                        <option value="+47" className="bg-gray-800">🇸🇯 Svalbard and Jan Mayen (+47)</option>
                        <option value="+268" className="bg-gray-800">🇸🇿 Swaziland (+268)</option>
                        <option value="+46" className="bg-gray-800">🇸🇪 Sweden (+46)</option>
                        <option value="+41" className="bg-gray-800">🇨🇭 Switzerland (+41)</option>
                        <option value="+963" className="bg-gray-800">🇸🇾 Syria (+963)</option>
                        <option value="+886" className="bg-gray-800">🇹🇼 Taiwan (+886)</option>
                        <option value="+992" className="bg-gray-800">🇹🇯 Tajikistan (+992)</option>
                        <option value="+255" className="bg-gray-800">🇹🇿 Tanzania (+255)</option>
                        <option value="+66" className="bg-gray-800">🇹🇭 Thailand (+66)</option>
                        <option value="+670" className="bg-gray-800">🇹🇱 Timor-Leste (+670)</option>
                        <option value="+228" className="bg-gray-800">🇹🇬 Togo (+228)</option>
                        <option value="+690" className="bg-gray-800">🇹🇰 Tokelau (+690)</option>
                        <option value="+676" className="bg-gray-800">🇹🇴 Tonga (+676)</option>
                        <option value="+1" className="bg-gray-800">🇹🇹 Trinidad and Tobago (+1)</option>
                        <option value="+216" className="bg-gray-800">🇹🇳 Tunisia (+216)</option>
                        <option value="+90" className="bg-gray-800">🇹🇷 Turkey (+90)</option>
                        <option value="+993" className="bg-gray-800">🇹🇲 Turkmenistan (+993)</option>
                        <option value="+1" className="bg-gray-800">🇹🇨 Turks and Caicos Islands (+1)</option>
                        <option value="+688" className="bg-gray-800">🇹🇻 Tuvalu (+688)</option>
                        <option value="+1" className="bg-gray-800">🇻🇮 U.S. Virgin Islands (+1)</option>
                        <option value="+256" className="bg-gray-800">🇺🇬 Uganda (+256)</option>
                        <option value="+380" className="bg-gray-800">🇺🇦 Ukraine (+380)</option>
                        <option value="+971" className="bg-gray-800">🇦🇪 United Arab Emirates (+971)</option>
                        <option value="+44" className="bg-gray-800">🇬🇧 United Kingdom (+44)</option>
                        <option value="+1" className="bg-gray-800">🇺🇸 United States (+1)</option>
                        <option value="+598" className="bg-gray-800">🇺🇾 Uruguay (+598)</option>
                        <option value="+998" className="bg-gray-800">🇺🇿 Uzbekistan (+998)</option>
                        <option value="+678" className="bg-gray-800">🇻🇺 Vanuatu (+678)</option>
                        <option value="+379" className="bg-gray-800">🇻🇦 Vatican City (+379)</option>
                        <option value="+58" className="bg-gray-800">🇻🇪 Venezuela (+58)</option>
                        <option value="+84" className="bg-gray-800">🇻🇳 Vietnam (+84)</option>
                        <option value="+681" className="bg-gray-800">🇼🇫 Wallis and Futuna (+681)</option>
                        <option value="+212" className="bg-gray-800">🇪🇭 Western Sahara (+212)</option>
                        <option value="+967" className="bg-gray-800">🇾🇪 Yemen (+967)</option>
                        <option value="+260" className="bg-gray-800">🇿🇲 Zambia (+260)</option>
                        <option value="+263" className="bg-gray-800">🇿🇼 Zimbabwe (+263)</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      required
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className={`flex-1 p-2.5 bg-gray-800/50 border ${
                        countryCode === '+92' && phoneNumber.length > 0 && !isValidPakistanNumber(phoneNumber)
                          ? 'border-red-500'
                          : 'border-gray-700'
                      } rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      placeholder={countryCode === '+92' ? '3XX XXXXXXX' : 'Enter phone number'}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {countryCode === '+92' ? 'Enter 10-digit mobile number starting with 3' : 'Enter phone number'}
                  </p>
                </div>

                <div>
                  <label htmlFor="lead" className="block text-sm font-medium text-gray-300 mb-1">
                    Lead Owner <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="lead"
                    required
                    value={lead}
                    onChange={(e) => setLead(e.target.value)}
                    className="w-full p-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="" className="bg-gray-800">Select Lead Owner</option>
                    <option value="pretty" className="bg-gray-800">Pretty</option>
                    <option value="asif" className="bg-gray-800">Asif</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isSubmitting || (countryCode === '+92' && !isValidPakistanNumber(phoneNumber))}
                className={`w-full sm:w-96 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg transition-all duration-200 shadow-lg text-lg font-medium ${
                  isSubmitting || (countryCode === '+92' && !isValidPakistanNumber(phoneNumber))
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:from-blue-600 hover:to-purple-600 hover:shadow-blue-500/20'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 
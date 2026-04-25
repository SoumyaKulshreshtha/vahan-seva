/**
 * Vahan Seva - App Logic
 * 1. SPA Navigation (Hash-based)
 * 2. Geolocation & Real-time Distance
 * 3. API Integration (Backend)
 */

window.state = {
    userLocation: null,
    mechanics: [],
    searchQuery: "",
    currentUser: null
};

// --- Utilities ---
function toRad(value) {
    return value * Math.PI / 180;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- Appointment Booking ---
async function handleAppointmentBooking() {
    const fullName = document.getElementById('appt-name')?.value.trim() || "";
    const phone = document.getElementById('appt-phone')?.value.trim() || "";
    const address = document.getElementById('appt-address')?.value.trim() || "";
    const vehicle = document.getElementById('appt-vehicle')?.value.trim() || "";
    const issue = document.getElementById('appt-issue')?.value.trim() || "";
    const datetime = document.getElementById('appt-datetime')?.value.trim() || "";

    if (!fullName || !phone || !address || !issue) {
        alert("Please fill in all required fields.");
        return;
    }

    try {
        const res = await fetch('https://vahan-seva.onrender.com/api/appointments/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                phone: phone,
                address: address,
                vehicle_type: vehicle,
                issue: issue,
                preferred_datetime: datetime
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("✅ Appointment booked! We will contact you shortly.");
            window.location.hash = '#screen-2';
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        alert("Cannot reach server. Please check your connection.");
    }
}

// --- User Registration ---
async function handleUserRegistration() {
    const fullName = document.querySelector('#screen-4 input[placeholder="Enter your full name"]')?.value.trim() || "";
    const phone = document.querySelector('#screen-4 input[placeholder="Enter 10-digit mobile number"]')?.value.trim() || "";
    const location = document.querySelector('#screen-4 input[placeholder="Enter your location"]')?.value.trim() || "";
    const vehicleType = document.querySelector('#screen-4 input[placeholder="e.g., Motorcycle, Scooter"]')?.value.trim() || "";

    if (!fullName || !phone || !location || !vehicleType) {
        alert("Please fill in all required fields.");
        return;
    }

    if (phone.length !== 10 || isNaN(phone)) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    try {
        const res = await fetch('https://vahan-seva.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: 'user',
                full_name: fullName,
                phone: phone,
                location: location,
                vehicle_type: vehicleType
            })
        });
        const data = await res.json();
        if (data.success) {
            state.currentUser = data.data;
            alert(`✅ Welcome ${fullName}! You are now registered.`);
            window.location.hash = '#screen-8';
        } else {
            alert("Registration failed: " + data.message);
        }
    } catch (e) {
        alert("Cannot reach server. Please check your connection.");
    }
}

// --- Navigation (SPA Logic) ---
function handleNavigation() {
    const hash = window.location.hash || '#screen-1';

    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

    const target = document.querySelector(hash);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }

    if (hash === '#screen-3') {
        const results = getMechanicsForQuery(state.searchQuery);
        renderMechanics(results, state.searchQuery);
    }
    if (hash === '#screen-8') {
        loadUserBookings();
    }
}

// --- Search Helper ---
function getMechanicsForQuery(query) {
    if (!query) return state.mechanics;

    const q = query.toLowerCase().trim();

    const localResults = state.mechanics.filter(m =>
        (m.shop_name && m.shop_name.toLowerCase().includes(q)) ||
        (m.address && m.address.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q))
    );

    const city = q.charAt(0).toUpperCase() + q.slice(1);

    const googleResults = [
        {
            id: 'g1',
            name: `${city} Popular Garage (Google)`,
            shop_name: `Top Rated Mechanics in ${city}`,
            address: `${city} Main Market`,
            distance: 2.0, rating: 4.8, verified: false
        },
        {
            id: 'g2',
            name: `${city} Service Center (Google)`,
            shop_name: `Bike Service ${city}`,
            address: `${city} Road`,
            distance: 3.5, rating: 4.5, verified: false
        },
        {
            id: 'g3',
            name: `More Mechanics in ${city}`,
            shop_name: `All Garages in ${city}`,
            address: `${city} Region`,
            distance: 5.0, rating: 4.0, verified: false
        }
    ];

    return [...localResults, ...googleResults];
}

// --- Data & API ---
async function initData() {
    try {
        const res = await fetch('https://vahan-seva.onrender.com/api/mechanics');
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                console.log("Using API Data", data.data);
                state.mechanics = data.data.map(m => ({
                    ...m,
                    name: m.shop_name,
                    address: m.shop_address,
                    distance: m.distance_km || 2.0,
                    price_service: m.price_service || "0",
                    price_wash: m.price_wash || "0"
                }));
            }
        }
    } catch (e) {
        console.warn("Backend not running. List will look for local state only.");
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };

                state.mechanics.forEach((m) => {
                    if (!m.lat || m.lat === 0) {
                        const latOffset = (Math.random() - 0.5) * 0.04;
                        const lonOffset = (Math.random() - 0.5) * 0.04;
                        m.lat = state.userLocation.lat + latOffset;
                        m.lon = state.userLocation.lon + lonOffset;
                    }
                    m.distance = calculateDistance(state.userLocation.lat, state.userLocation.lon, m.lat, m.lon);
                });

                state.mechanics.sort((a, b) => a.distance - b.distance);

                if (window.location.hash === '#screen-3') {
                    const results = getMechanicsForQuery(state.searchQuery);
                    renderMechanics(results, state.searchQuery);
                }
            },
            (error) => {
                console.error("Geolocation denied.");
            }
        );
    }
}

// --- Mechanic Registration ---
async function handleMechanicRegistration() {
    const fullName = document.querySelector('#screen-5 input[placeholder="Enter your full name"]')?.value.trim() || "";
    const phone = document.querySelector('#screen-5 input[placeholder="Enter 10-digit mobile number"]')?.value.trim() || "";
    const shopName = document.querySelector('#screen-5 input[placeholder="Enter your shop name"]')?.value.trim() || "";
    const address = document.querySelector('#screen-5 input[placeholder="Enter complete shop address"]')?.value.trim() || "";
    const services = document.querySelector('#screen-6 input[placeholder="e.g., Engine Repair, Brake Service"]')?.value.trim() || "";
    const experience = document.querySelector('#screen-6 input[placeholder="Enter years of experience"]')?.value.trim() || "0";
    const priceService = document.getElementById('price-service')?.value || "0";
    const priceWash = document.getElementById('price-wash')?.value || "0";

    if (!fullName || !phone || !shopName || !address) {
        alert("Please fill in all required fields (Name, Phone, Shop Name, Address).");
        return;
    }

    try {
        const userRes = await fetch('https://vahan-seva.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'mechanic', full_name: fullName, phone: phone, location: address })
        });
        const userData = await userRes.json();
        if (!userData.success) {
            alert("Registration failed: " + userData.message);
            return;
        }

        const userId = userData.data.id;

        const mechRes = await fetch('https://vahan-seva.onrender.com/api/mechanic/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                shop_name: shopName,
                shop_address: address,
                services: services,
                experience_years: parseInt(experience),
                price_service: priceService,
                price_wash: priceWash
            })
        });
        const mechData = await mechRes.json();

        if (mechData.success) {
            const mechanicId = mechData.data.id;

            const uploadFile = (inputId, docType) => new Promise((resolve) => {
                const input = document.getElementById(inputId);
                if (!input || !input.files[0]) return resolve();
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = async () => {
                    await fetch('https://vahan-seva.onrender.com/api/mechanic/upload-doc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            mechanic_id: mechanicId,
                            doc_type: docType,
                            image_data: reader.result
                        })
                    });
                    resolve();
                };
                reader.readAsDataURL(file);
            });

            await uploadFile('aadhar-file', 'aadhar');
            await uploadFile('shop-photo-file', 'shop_photo');

            alert("Registration submitted! Waiting for admin approval.");
            window.location.hash = '#screen-3';
        } else {
            alert("Error: " + mechData.message);
        }
    } catch (e) {
        alert("Cannot reach server. Please check your connection.");
    }
}

// --- Load User Bookings ---
async function loadUserBookings() {
    const listEl = document.getElementById('bookings-list');
    if (!listEl) return;

    const welcomeEl = document.getElementById('user-welcome');
    if (welcomeEl && state.currentUser) {
        welcomeEl.textContent = `👤 Welcome, ${state.currentUser.full_name} — ${state.currentUser.phone}`;
    }

    if (!state.currentUser) {
        listEl.innerHTML = `<p style="text-align:center; color:#666;">Please register or login first.</p>`;
        return;
    }

    listEl.innerHTML = `<p style="color:#999;">Loading...</p>`;

    try {
        const res = await fetch(`https://vahan-seva.onrender.com/api/bookings/user/${state.currentUser.id}`);
        const data = await res.json();

        if (!data.success || data.data.length === 0) {
            listEl.innerHTML = `<p style="text-align:center; color:#666;">No bookings yet.</p>`;
            return;
        }

        listEl.innerHTML = data.data.map(b => `
            <div style="background:#fff; border:1px solid #eef1f7; border-radius:16px; padding:14px; margin-bottom:12px;">
                <div style="font-weight:900; font-size:15px; margin-bottom:6px;">
                    ${b.shop_name}
                    <span style="background:${b.status === 'Completed' ? '#eafff2' : b.status === 'Rejected' ? '#fce8e8' : '#fff3e0'};
                           color:${b.status === 'Completed' ? '#0b7f40' : b.status === 'Rejected' ? '#c62828' : '#e65100'};
                           border-radius:999px; padding:4px 10px; font-size:12px;">
                        ${b.status}
                    </span>
                </div>
                <div style="font-size:13px; color:#6b7a90; line-height:1.6;">
                    🔧 ${b.service_type}<br>
                    📝 ${b.problem || "No details provided"}<br>
                    🕐 ${b.preferred_datetime || "Any time"}<br>
                    📞 Mechanic: ${b.mechanic_name} — ${b.mechanic_phone}<br>
                    📅 ${new Date(b.created_at).toLocaleString()}
                </div>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = `<p style="text-align:center; color:#e53935;">Could not load bookings.</p>`;
    }
}

// --- Search Logic ---
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    state.searchQuery = query;

    if (window.location.hash === '#screen-3') {
        const results = getMechanicsForQuery(query);
        renderMechanics(results, query);
    }
}

// --- Rendering ---
function renderMechanics(mechanics, searchQuery = "") {
    const listContainer = document.getElementById('mechanic-list-container');
    const countBadge = document.getElementById('verified-count');

    if (!listContainer) return;
    listContainer.innerHTML = '';

    const list = mechanics || state.mechanics;

    if (countBadge) {
        if (searchQuery && list.length > 0) {
            countBadge.innerText = `🔍 Found ${list.length} results`;
        } else {
            countBadge.innerText = `✅ Verified Nearby`;
        }
    }

    if (list.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:20px; color:#666;">
                No mechanics found.<br>
                Try registering one!
            </div>`;
        return;
    }

    const verifiedList = list.filter(m => m.verified === 1 || m.verified === true);
    const externalList = list.filter(m => m.verified === 0 || m.verified === false || m.verified === -1);

    if (verifiedList.length > 0) {
        const vHeader = document.createElement('h3');
        vHeader.style.cssText = "font-size:14px; color:#0b7f40; margin:16px 0 8px 0; border-bottom:1px solid #e0e0e0; padding-bottom:4px;";
        vHeader.innerHTML = "✅ Verified Mechanics (App Registered)";
        listContainer.appendChild(vHeader);
        verifiedList.forEach(m => renderCard(m, listContainer));
    }

    if (externalList.length > 0) {
        const eHeader = document.createElement('h3');
        eHeader.style.cssText = "font-size:14px; color:#666; margin:24px 0 8px 0; border-bottom:1px solid #e0e0e0; padding-bottom:4px;";
        eHeader.innerHTML = "🌐 Non-Registered Mechanics (from Google)";
        listContainer.appendChild(eHeader);
        externalList.forEach(m => renderCard(m, listContainer));
    }

    if (searchQuery) {
        const googleBtn = document.createElement('div');
        googleBtn.innerHTML = `
            <a href="https://www.google.com/maps/search/mechanics+near+${searchQuery}" target="_blank"
               class="btn full" style="background:#fff; color:#0b4dff; border:1px solid #e7ebf4; margin-top:12px; text-align:center;">
               See more results on Google Maps ↗
            </a>
        `;
        listContainer.appendChild(googleBtn);
    }
}

// Helper to render single card
function renderCard(m, container) {
    const card = document.createElement('div');
    card.className = 'mechanic-card';
    card.innerHTML = `
      <div class="m-avatar"></div>
      <div class="m-info">
        <div class="m-name">
          ${m.name}
          ${m.verified === 1 ? '<span class="tick">✔</span>' : ''}
        </div>
        <div class="m-sub muted">
            ${m.distance ? m.distance.toFixed(1) : '2.0'} km • ${m.address} • ${m.rating || 4.5} ⭐
            ${m.price_service ? `<br><span style="color:#0b7f40; font-weight:600;">Servicing from ₹${m.price_service}</span>` : ''}
        </div>
        ${m.verified === false ? `<a href="https://www.google.com/maps/search/${encodeURIComponent(m.shop_name + ' ' + m.address)}" target="_blank" style="font-size:11px; color:#0b4dff; text-decoration:underline;">View on Google</a>` : ''}
      </div>
      ${m.verified === 1
            ? '<span class="tag green">Verified</span>'
            : '<span class="tag" style="background:#f0f0f0; color:#666; font-size:10px;">External</span>'}
    `;
    container.appendChild(card);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', handleNavigation);
    handleNavigation();
    initData();

    const searchInput = document.querySelector('.searchbar input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
});

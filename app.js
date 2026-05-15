// Initialize Supabase client
const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);

// Public page functionality
if (document.getElementById('appointmentForm')) {
    const form = document.getElementById('appointmentForm');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value.trim();
        const mobile = document.getElementById('mobile').value.trim();
        
        // Basic validation
        if (!name || !mobile) {
            showError('Please fill in all fields');
            return;
        }
        
        // Mobile number validation (simple)
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(mobile)) {
            showError('Please enter a valid 10-digit mobile number');
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from('appointment_requests')
                .insert([
                    { 
                        name: name, 
                        mobile: mobile,
                        status: 'New',
                        notes: null
                    }
                ]);
            
            if (error) throw error;
            
            // Show success message
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
            form.reset();
            
            // Hide success message after 5 seconds
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 5000);
            
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to submit request. Please try again.');
        }
    });
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

// Admin panel functionality
if (document.getElementById('adminLoginForm')) {
    let currentUser = null;
    
    const loginForm = document.getElementById('adminLoginForm');
    const loginFormDiv = document.getElementById('loginForm');
    const dashboard = document.getElementById('dashboard');
    const loginError = document.getElementById('loginError');
    
    // Check if user is already logged in
    checkSession();
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            // Check if user is admin
            const { data: adminData, error: adminError } = await supabase
                .from('admins')
                .select('user_id')
                .eq('user_id', data.user.id)
                .single();
            
            if (adminError || !adminData) {
                await supabase.auth.signOut();
                throw new Error('You are not authorized as admin');
            }
            
            currentUser = data.user;
            showDashboard();
            
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        }
    });
    
    async function checkSession() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && session.user) {
                // Check if user is admin
                const { data: adminData, error: adminError } = await supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', session.user.id)
                    .single();
                
                if (!adminError && adminData) {
                    currentUser = session.user;
                    showDashboard();
                } else {
                    await supabase.auth.signOut();
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }
    
    async function showDashboard() {
        loginFormDiv.style.display = 'none';
        dashboard.style.display = 'block';
        await loadAppointments();
        startRealtimeSubscription();
    }
    
    async function loadAppointments() {
        try {
            const { data: appointments, error } = await supabase
                .from('appointment_requests')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            displayAppointments(appointments);
            updateStats(appointments);
            
        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    }
    
    function displayAppointments(appointments) {
        const tbody = document.getElementById('appointmentsBody');
        tbody.innerHTML = '';
        
        appointments.forEach(appointment => {
            const row = tbody.insertRow();
            
            row.insertCell(0).textContent = appointment.name;
            row.insertCell(1).textContent = appointment.mobile;
            
            // Status select
            const statusCell = row.insertCell(2);
            const statusSelect = document.createElement('select');
            statusSelect.className = 'status-select';
            statusSelect.innerHTML = `
                <option value="New" ${appointment.status === 'New' ? 'selected' : ''}>New</option>
                <option value="Called" ${appointment.status === 'Called' ? 'selected' : ''}>Called</option>
                <option value="Confirmed" ${appointment.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            `;
            statusCell.appendChild(statusSelect);
            
            // Notes input
            const notesCell = row.insertCell(3);
            const notesInput = document.createElement('input');
            notesInput.type = 'text';
            notesInput.className = 'notes-input';
            notesInput.value = appointment.notes || '';
            notesCell.appendChild(notesInput);
            
            // Created at
            row.insertCell(4).textContent = new Date(appointment.created_at).toLocaleString();
            
            // Actions
            const actionsCell = row.insertCell(5);
            
            const updateBtn = document.createElement('button');
            updateBtn.textContent = 'Update';
            updateBtn.className = 'update-btn';
            updateBtn.onclick = () => updateAppointment(appointment.id, statusSelect.value, notesInput.value);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteAppointment(appointment.id);
            
            actionsCell.appendChild(updateBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }
    
    async function updateAppointment(id, status, notes) {
        try {
            const { error } = await supabase
                .from('appointment_requests')
                .update({ status: status, notes: notes })
                .eq('id', id);
            
            if (error) throw error;
            
            await loadAppointments(); // Refresh the list
            
        } catch (error) {
            console.error('Error updating appointment:', error);
            alert('Failed to update appointment');
        }
    }
    
    async function deleteAppointment(id) {
        if (confirm('Are you sure you want to delete this appointment request?')) {
            try {
                const { error } = await supabase
                    .from('appointment_requests')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                
                await loadAppointments(); // Refresh the list
                
            } catch (error) {
                console.error('Error deleting appointment:', error);
                alert('Failed to delete appointment');
            }
        }
    }
    
    function updateStats(appointments) {
        document.getElementById('totalCount').textContent = appointments.length;
        const newCount = appointments.filter(a => a.status === 'New').length;
        document.getElementById('newCount').textContent = newCount;
    }
    
    function startRealtimeSubscription() {
        supabase
            .channel('appointment_requests')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'appointment_requests' }, 
                () => loadAppointments()
            )
            .subscribe();
    }
    
    // Logout functionality
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentUser = null;
        loginFormDiv.style.display = 'block';
        dashboard.style.display = 'none';
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
    });
}

/*

Claude Sonnet 4 (https://claude.ai/) was used to generate the following code solutions in this assignment:
  
  1. HTTP Method Detection - The determineHttpMethod() function for automatically routing SELECT queries to GET and INSERT queries to POST methods.
  
  2. Response Formatting - The formatResponse() function for dynamically generating HTML tables and formatting server responses with success/error styling.
      
  3. DOM Manipulation - The dynamic HTML generation and innerHTML updates for displaying query results and server responses.
  
*/

const API_BASE_URL = 'https://comp4537-lab-in-pair-2.onrender.com'; // Update this to your server2 URL
const UI_STRINGS = {
    LOADING: 'Processing...',
    ERROR_NETWORK: 'Network error occurred. Please check if the server is running.',
    ERROR_EMPTY_QUERY: 'Please enter a SQL query.',
    SUCCESS_INSERT: 'Default patients inserted successfully!',
    QUERY_SENT: 'Query submitted successfully!',
    PLACEHOLDER_QUERY: 'Enter your SQL query here (SELECT or INSERT only)\nExample: SELECT * FROM patient',
    ERROR_UNAUTHORIZED: 'You must be logged in to use this service. Please register or login.',
    API_LIMIT_WARNING: 'You have reached your maximum free API calls (20). Service continues with warning.'
};

function getAuthToken() {
    // Try to get token from localStorage first
    let token = localStorage.getItem('authToken');
    
    // If not in localStorage, try to get from cookies
    if (!token) {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token') {
                token = value;
                localStorage.setItem('authToken', token);
                break;
            }
        }
    }
    
    return token;
}

function showApiWarning() {
    // Check if warning already displayed
    let warningDiv = document.getElementById('apiLimitWarning');
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'apiLimitWarning';
        warningDiv.className = 'warning';
        warningDiv.style.cssText = 'background-color: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 1rem; margin: 1rem 0; border-radius: 4px;';
        warningDiv.textContent = UI_STRINGS.API_LIMIT_WARNING;
        
        // Insert at the top of the page or in a visible location
        const main = document.querySelector('main') || document.body;
        main.insertBefore(warningDiv, main.firstChild);
    }
}

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
function formatResponse(data) {
    if (data.success) {
        let html = `<div class="success">✓ ${data.message}</div>`;
        
        // Show API call tracking info
        if (data.apiCallsUsed !== undefined) {
            html += `<div class="info" style="margin: 0.5rem 0;">API calls used: ${data.apiCallsUsed}/20</div>`;
        }
        
        // Show warning if API limit reached
        if (data.apiLimitWarning) {
            html += `<div class="warning" style="background-color: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px;">⚠ ${data.apiLimitWarning}</div>`;
            showApiWarning();
        }
        
        if (data.data && Array.isArray(data.data)) {
            if (data.data.length > 0) {
                html += '<div class="data-table">';
                html += '<table>';
                
                const headers = Object.keys(data.data[0]);
                html += '<thead><tr>';
                headers.forEach(header => {
                    html += `<th>${header}</th>`;
                });
                html += '</tr></thead>';
                
                html += '<tbody>';
                data.data.forEach(row => {
                    html += '<tr>';
                    headers.forEach(header => {
                        html += `<td>${row[header] || ''}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody>';
                
                html += '</table>';
                html += `<div class="row-count">${data.data.length} row(s) returned</div>`;
                html += '</div>';
            } else {
                html += '<div class="info">No rows returned.</div>';
            }
        }
        
        if (data.results && Array.isArray(data.results)) {
            html += '<div class="insert-results">';
            data.results.forEach((result, index) => {
                const status = result.success ? '✓' : '✗';
                const className = result.success ? 'success' : 'error';
                html += `<div class="${className}">${status} Row ${index + 1}: ${result.message}</div>`;
            });
            html += '</div>';
        }
        
        return html;
    } else {
        let errorHtml = `<div class="error">✗ ${data.message}</div>`;
        
        // If unauthorized, provide link to login/register
        if (data.message && data.message.toLowerCase().includes('unauthorized')) {
            errorHtml += `<div class="info" style="margin-top: 0.5rem;"><a href="/login.html" style="color: blue; text-decoration: underline;">Login</a> or <a href="/createUser.html" style="color: blue; text-decoration: underline;">Register</a> to continue</div>`;
        }
        
        return errorHtml;
    }
}

// This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
function determineHttpMethod(query) {
    const trimmedQuery = query.trim().toUpperCase();
    if (trimmedQuery.startsWith('SELECT')) {
        return 'GET';
    } else if (trimmedQuery.startsWith('INSERT')) {
        return 'POST';
    } else {
        return 'POST';
    }
}

async function makeRequest(url, method, data = null) {
    try {
        const token = getAuthToken();
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Important for cookies
        };
        
        // Add Authorization header if token exists
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (data && method === 'POST') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            // Clear stored token
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            return {
                success: false,
                message: UI_STRINGS.ERROR_UNAUTHORIZED
            };
        }
        
        const result = await response.json();
        
        // Update token if new one is provided
        if (result.token) {
            localStorage.setItem('authToken', result.token);
        }
        
        return result;
    } catch (error) {
        console.error('Request error:', error);
        return {
            success: false,
            message: UI_STRINGS.ERROR_NETWORK
        };
    }
}

async function insertDefaultPatients() {
    const responseDiv = document.getElementById('insertResponse');
    responseDiv.innerHTML = `<div class="loading">${UI_STRINGS.LOADING}</div>`;
    
    const result = await makeRequest(`${API_BASE_URL}/api/v1/patients/default`, 'POST');
    responseDiv.innerHTML = formatResponse(result);
}

async function submitQuery() {
    const queryInput = document.getElementById('queryInput');
    const responseDiv = document.getElementById('queryResponse');
    const query = queryInput.value.trim();
    
    if (!query) {
        responseDiv.innerHTML = `<div class="error">${UI_STRINGS.ERROR_EMPTY_QUERY}</div>`;
        return;
    }
    
    responseDiv.innerHTML = `<div class="loading">${UI_STRINGS.LOADING}</div>`;
    
    const method = determineHttpMethod(query);
    let result;
    
    if (method === 'GET') {
        const encodedQuery = encodeURIComponent(query);
        const url = `${API_BASE_URL}/api/v1/sql/${encodedQuery}`;
        result = await makeRequest(url, 'GET');
    } else {
        const url = `${API_BASE_URL}/api/v1/sql`;
        result = await makeRequest(url, 'POST', { query: query });
    }
    
    // This block of code below was assisted by Claude Sonnet 4 (https://claude.ai/)
    responseDiv.innerHTML = formatResponse(result);
}

function initializeEventListeners() {
    const insertButton = document.getElementById('insertButton');
    const submitButton = document.getElementById('submitQuery');
    const queryInput = document.getElementById('queryInput');
    
    insertButton.addEventListener('click', insertDefaultPatients);
    submitButton.addEventListener('click', submitQuery);
    
    queryInput.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            submitQuery();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    
    console.log('Patient Database Client initialized');
    console.log('Server URL:', API_BASE_URL);
});
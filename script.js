// Initialize Stripe
const stripe = Stripe('pk_test_your_publishable_key'); // Replace with your publishable key

// User Management System
let currentUser = null;
let isLoggedIn = false;
let conversationHistory = [];
let isGenerating = false;
let dailyUsage = 0;
let userMemory = [];

// User tiers and limits (updated with Stripe integration)
const userTiers = {
    free: { dailyLimit: 3, name: 'Free', price: 0, stripePriceId: null },
    creator: { dailyLimit: 5, name: 'Creator Pro', price: 7.99, stripePriceId: 'creator_monthly' },
    business: { dailyLimit: 10, name: 'Business Elite', price: 12.99, stripePriceId: 'business_monthly' },
    enterprise: { dailyLimit: Infinity, name: 'Enterprise', price: 37.99, stripePriceId: 'enterprise_monthly' }
};

// Initialize the application
function initializeApp() {
    checkAuthStatus();
    loadUserData();
    initializePayments(); // Add payment initialization
    updateAIStatus('Initializing...', true);
    
    setTimeout(() => {
        updateAIStatus('Ready', false);
    }, 1500);
}

function checkAuthStatus() {
    const userData = localStorage.getItem('socialMediaAI_user');
    if (userData) {
        currentUser = JSON.parse(userData);
        isLoggedIn = true;
        setupAuthenticatedUI();
    } else {
        showAuthModal();
    }
}

function loadUserData() {
    if (!isLoggedIn) return;
    
    // Load conversation history
    const savedHistory = localStorage.getItem(`conversations_${currentUser.id}`);
    if (savedHistory) {
        conversationHistory = JSON.parse(savedHistory);
        restoreConversation();
    }
    
    // Load daily usage
    const today = new Date().toDateString();
    const savedUsage = localStorage.getItem(`usage_${currentUser.id}_${today}`);
    dailyUsage = savedUsage ? parseInt(savedUsage) : 0;
    
    // Load user memory
    const savedMemory = localStorage.getItem(`memory_${currentUser.id}`);
    if (savedMemory) {
        userMemory = JSON.parse(savedMemory);
    }
    
    updateUsageCounter();
}

function setupAuthenticatedUI() {
    document.getElementById('authModal').classList.add('hidden');
    updateUserDisplay();
    updateUsageCounter();
}

function updateUserDisplay() {
    if (!currentUser) return;
    
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userTier = document.getElementById('userTier');
    const billingPortal = document.getElementById('billingPortal');
    
    userAvatar.textContent = currentUser.name?.charAt(0).toUpperCase() || 'U';
    userName.textContent = currentUser.name || currentUser.email;
    
    const tierInfo = userTiers[currentUser.tier || 'free'];
    userTier.textContent = tierInfo.name;
    userTier.className = `tier-badge ${currentUser.tier || 'free'}`;
    
    // Show/hide billing portal based on subscription status
    if (currentUser.stripe_customer_id && currentUser.tier !== 'free') {
        billingPortal.style.display = 'block';
    } else {
        billingPortal.style.display = 'none';
    }
}

function updateUsageCounter() {
    if (!isLoggedIn) return;
    
    const counter = document.getElementById('usageCounter');
    const tierInfo = userTiers[currentUser.tier || 'free'];
    const limit = tierInfo.dailyLimit;
    
    if (limit === Infinity) {
        counter.textContent = `${dailyUsage} ideas today`;
        counter.classList.remove('warning');
    } else {
        counter.textContent = `${dailyUsage}/${limit} ideas today`;
        counter.classList.toggle('warning', dailyUsage >= limit - 1);
    }
}

// Authentication handlers
function handleOAuth(provider) {
    // In production, these would redirect to actual OAuth endpoints
    const oauthUrls = {
        google: 'https://accounts.google.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT&scope=email profile&response_type=code',
        twitter: 'https://api.twitter.com/oauth/authenticate?oauth_token=YOUR_TOKEN',
        github: 'https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=user:email'
    };
    
    // For demo, simulate successful OAuth
    simulateOAuthSuccess(provider);
}

function simulateOAuthSuccess(provider) {
    const mockUser = {
        id: `${provider}_${Date.now()}`,
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
        email: `user@${provider}.com`,
        provider: provider,
        tier: 'free',
        createdAt: new Date().toISOString()
    };
    
    completeAuthentication(mockUser);
}

function handleEmailAuth() {
    const email = document.getElementById('emailInput').value;
    const authMode = document.getElementById('authTitle').textContent;
    
    if (!email) {
        alert('Please enter your email');
        return;
    }
    
    // For demo, simulate email auth
    const mockUser = {
        id: `email_${Date.now()}`,
        name: email.split('@')[0],
        email: email,
        provider: 'email',
        tier: 'free',
        createdAt: new Date().toISOString()
    };
    
    completeAuthentication(mockUser);
}

function completeAuthentication(user) {
    currentUser = user;
    isLoggedIn = true;
    
    // Save user data
    localStorage.setItem('socialMediaAI_user', JSON.stringify(user));
    
    // Initialize user-specific data
    dailyUsage = 0;
    userMemory = [];
    conversationHistory = [];
    
    setupAuthenticatedUI();
    
    // Welcome message
    setTimeout(() => {
        addMessage(`Welcome back${user.name ? ', ' + user.name : ''}! I remember our previous conversations and I'm ready to help you create amazing content.`, 'ai');
    }, 1000);
}

function toggleAuthMode() {
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const button = document.getElementById('emailAuthButton');
    const toggle = document.querySelector('.auth-toggle');
    const passwordInput = document.getElementById('passwordInput');
    
    if (title.textContent === 'Sign In') {
        title.textContent = 'Sign Up';
        subtitle.textContent = 'Create your account to get started';
        button.textContent = 'Create Account';
        toggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode()">Sign in</a>';
        passwordInput.style.display = 'block';
    } else {
        title.textContent = 'Sign In';
        subtitle.textContent = 'Continue with your social account or email';
        button.textContent = 'Continue with Email';
        toggle.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleAuthMode()">Sign up</a>';
        passwordInput.style.display = 'none';
    }
}

function logout() {
    if (confirm('Are you sure you want to sign out?')) {
        localStorage.removeItem('socialMediaAI_user');
        currentUser = null;
        isLoggedIn = false;
        location.reload();
    }
}

// Usage tracking and limits
function checkUsageLimit() {
    const tierInfo = userTiers[currentUser?.tier || 'free'];
    return dailyUsage < tierInfo.dailyLimit;
}

function incrementUsage() {
    dailyUsage++;
    const today = new Date().toDateString();
    localStorage.setItem(`usage_${currentUser.id}_${today}`, dailyUsage.toString());
    updateUsageCounter();
}

// Payment integration functions
async function processUpgrade(tier, isYearly = false) {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    const tierInfo = userTiers[tier];
    if (!tierInfo.stripePriceId) return;

    const priceKey = isYearly ? `${tier}_yearly` : `${tier}_monthly`;
    
    try {
        // Show loading state
        updateAIStatus('Processing payment...', true);
        
        const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                price_lookup_key: priceKey,
                customer_email: currentUser.email,
                user_id: currentUser.id
            }),
        });

        const { url } = await response.json();
        
        // Redirect to Stripe Checkout
        window.location.href = url;
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment processing failed. Please try again.');
        updateAIStatus('Ready', false);
    }
}

async function openCustomerPortal() {
    if (!currentUser?.stripe_customer_id) {
        alert('No active subscription found.');
        return;
    }

    try {
        const response = await fetch('/api/create-portal-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer_id: currentUser.stripe_customer_id
            }),
        });

        const { url } = await response.json();
        window.location.href = url;
        
    } catch (error) {
        console.error('Portal error:', error);
        alert('Unable to open billing portal. Please contact support.');
    }
}

function selectTier(tier, isYearly = false) {
    const tierInfo = userTiers[tier];
    const price = isYearly ? (tierInfo.price * 10.5).toFixed(2) : tierInfo.price; // Yearly discount
    const period = isYearly ? 'year' : 'month';
    
    const confirmMessage = `Subscribe to ${tierInfo.name} for $${price}/${period}?${isYearly ? ' (2 months free!)' : ''}`;
    
    if (confirm(confirmMessage)) {
        processUpgrade(tier, isYearly);
    }
}

// Check subscription status on page load
async function checkSubscriptionStatus() {
    if (!isLoggedIn) return;
    
    try {
        const response = await fetch(`/api/user/${currentUser.id}/subscription`);
        const subscriptionData = await response.json();
        
        if (subscriptionData.tier) {
            currentUser.tier = subscriptionData.tier;
            currentUser.subscription_status = subscriptionData.status;
            currentUser.stripe_customer_id = subscriptionData.stripe_customer_id;
            
            updateUserDisplay();
            updateUsageCounter();
        }
    } catch (error) {
        console.log('Subscription check failed:', error);
    }
}

// Handle successful payment redirect
function handlePaymentSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
        // Show success message
        setTimeout(() => {
            addMessage('🎉 Payment successful! Your subscription is now active. Welcome to premium features!', 'ai');
            checkSubscriptionStatus(); // Refresh subscription status
        }, 1000);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Enhanced upgrade modal with real pricing
function showUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    const modalContent = modal.querySelector('.upgrade-container');
    
    modalContent.innerHTML = `
        <button class="close-modal" onclick="closeUpgradeModal()">×</button>
        <h2>Choose Your Plan</h2>
        
        <div style="text-align: center; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #ccc;">
                <input type="radio" name="billing" value="monthly" checked onchange="updatePricing()"> Monthly
                <input type="radio" name="billing" value="yearly" onchange="updatePricing()"> Yearly (Save up to 22%)
            </label>
        </div>
        
        <div class="pricing-tiers">
            <div class="pricing-tier" onclick="selectTierFromModal('creator')">
                <div class="tier-name">Creator Pro</div>
                <div class="tier-price" id="creator-price">$7.99<span class="period">/month</span></div>
                <ul class="tier-features">
                    <li>5 ideas per day</li>
                    <li>Advanced analytics</li>
                    <li>Standard templates</li>
                    <li>Email support</li>
                    <li>7-day free trial</li>
                </ul>
                <button class="upgrade-button">Start Free Trial</button>
            </div>
            
            <div class="pricing-tier popular" onclick="selectTierFromModal('business')">
                <div class="tier-name">Business Elite</div>
                <div class="tier-price" id="business-price">$12.99<span class="period">/month</span></div>
                <ul class="tier-features">
                    <li>10 ideas per day</li>
                    <li>Brand voice training</li>
                    <li>Competitor analysis</li>
                    <li>Priority support</li>
                    <li>7-day free trial</li>
                </ul>
                <button class="upgrade-button">Start Free Trial</button>
            </div>
            
            <div class="pricing-tier" onclick="selectTierFromModal('enterprise')">
                <div class="tier-name">Enterprise</div>
                <div class="tier-price" id="enterprise-price">$37.99<span class="period">/month</span></div>
                <ul class="tier-features">
                    <li>Unlimited ideas</li>
                    <li>Team collaboration</li>
                    <li>API access</li>
                    <li>Dedicated manager</li>
                    <li>7-day free trial</li>
                </ul>
                <button class="upgrade-button">Start Free Trial</button>
            </div>
        </div>
        
        <p style="text-align: center; color: #888; font-size: 0.8rem; margin-top: 16px;">
            💳 Secure payment by Stripe • Cancel anytime • No hidden fees
        </p>
        
        ${currentUser?.stripe_customer_id ? 
            '<button onclick="openCustomerPortal()" style="width: 100%; margin-top: 16px; padding: 12px; background: #333; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Manage Existing Subscription</button>' 
            : ''}
    `;
    
    modal.classList.remove('hidden');
    toggleUserMenu();
}

function updatePricing() {
    const billingType = document.querySelector('input[name="billing"]:checked').value;
    const isYearly = billingType === 'yearly';
    
    const prices = {
        creator: isYearly ? 6.99 * 12 : 7.99,
        business: isYearly ? 10.99 * 12 : 12.99,
        enterprise: isYearly ? 30.99 * 12 : 37.99
    };
    
    Object.keys(prices).forEach(tier => {
        const element = document.getElementById(`${tier}-price`);
        if (element) {
            const period = isYearly ? '/year' : '/month';
            const savings = isYearly ? ' (2 months free!)' : '';
            element.innerHTML = `$${prices[tier].toFixed(2)}<span class="period">${period}</span>${savings}`;
        }
    });
}

function selectTierFromModal(tier) {
    const isYearly = document.querySelector('input[name="billing"]:checked').value === 'yearly';
    closeUpgradeModal();
    selectTier(tier, isYearly);
}

// Initialize payment system
function initializePayments() {
    // Check for payment success
    handlePaymentSuccess();
    
    // Check subscription status
    checkSubscriptionStatus();
}

function closeUpgradeModal() {
    document.getElementById('upgradeModal').classList.add('hidden');
}

// Memory system
function saveToMemory(content, type = 'conversation') {
    const memoryItem = {
        id: Date.now(),
        content: content,
        type: type,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id
    };
    
    userMemory.push(memoryItem);
    
    // Keep only last 100 memory items
    if (userMemory.length > 100) {
        userMemory = userMemory.slice(-100);
    }
    
    localStorage.setItem(`memory_${currentUser.id}`, JSON.stringify(userMemory));
}

function viewMemory() {
    const memoryContent = userMemory
        .slice(-10) // Show last 10 memories
        .reverse()
        .map(item => `${new Date(item.timestamp).toLocaleString()}: ${item.content.substring(0, 100)}...`)
        .join('\n\n');
        
    alert(`Recent Memory:\n\n${memoryContent || 'No memory data available'}`);
    toggleUserMenu();
}

function exportData() {
    const exportData = {
        user: currentUser,
        conversations: conversationHistory,
        memory: userMemory,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-media-ai-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toggleUserMenu();
}

// UI interaction handlers
function toggleUserMenu() {
    const menu = document.getElementById('dropdownMenu');
    menu.classList.toggle('show');
}

function showAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function updateAIStatus(status, active) {
    const statusElement = document.getElementById('aiStatus');
    const text = statusElement.querySelector('span');
    
    text.textContent = status;
    statusElement.classList.toggle('active', active);
}

// Web search functionality
async function searchWebForTrends(query) {
    // Simulate web search - in production, integrate with actual search API
    const trendingTopics = [
        'AI automation', 'sustainable living', 'remote work culture', 'mental wellness',
        'creator economy', 'web3 adoption', 'digital minimalism', 'micro-learning',
        'community building', 'authentic storytelling', 'vertical video', 'user-generated content'
    ];
    
    // Randomize to simulate fresh data
    return trendingTopics.sort(() => Math.random() - 0.5).slice(0, 8);
}

async function searchWebForContent(query, context) {
    updateAIStatus('Searching web for content ideas...', true);
    
    // Simulate web search for content
    return new Promise(resolve => {
        setTimeout(() => {
            const contentIdeas = generateContentFromSearch(query, context);
            resolve(contentIdeas);
        }, 2000);
    });
}

function generateContentFromSearch(query, context) {
    const ideas = [];
    
    // Generate content based on parsed intent
    for (let i = 0; i < 6; i++) {
        ideas.push({
            title: generateTitle(context, i),
            content: generateContent(context, i),
            hashtags: generateHashtags(context, i),
            type: context.contentType || 'post',
            platform: context.platform || 'multi-platform',
            engagement: `Est. ${Math.floor(Math.random() * 50 + 10)}K+ reach`,
            source: 'web_research'
        });
    }
    
    return ideas;
}

function generateTitle(context, index) {
    const titleTemplates = [
        `${context.topic}: Strategic content framework`,
        `${context.topic} dominance on ${context.platform || 'social platforms'}`,
        `High-converting ${context.topic} strategies`,
        `${context.topic}: Industry insights & tactics`,
        `Executive guide to ${context.topic} for ${context.audience || 'target demographics'}`,
        `${context.topic}: Performance-driven approach`
    ];
    return titleTemplates[index % titleTemplates.length];
}

function generateContent(context, index) {
    const contentTemplates = [
        `Market analysis reveals ${context.topic} drives measurable engagement for ${context.audience || 'target audiences'}.`,
        `Strategic implementation of ${context.topic} increases conversion rates by up to 340% across platforms.`,
        `Data indicates ${context.topic} content outperforms standard formats by significant margins.`,
        `Professional analysis: ${context.topic} represents critical competitive advantage in 2025.`,
        `Leading brands leverage ${context.topic} for authentic audience connection and retention.`,
        `Performance metrics confirm ${context.topic} generates superior engagement compared to traditional approaches.`
    ];
    return contentTemplates[index % contentTemplates.length];
}

// Message handling
async function sendMessage() {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || isGenerating) return;
    
    // Check usage limits
    if (!checkUsageLimit()) {
        showLimitWarning();
        return;
    }
    
    isGenerating = true;
    input.value = '';
    
    // Add user message
    addMessage(message, 'user');
    saveConversation();
    saveToMemory(`User asked: ${message}`, 'user_query');
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        // Parse user intent
        const context = parseUserIntent(message);
        
        // Simulate web search and content generation
        const contentIdeas = await generateContentWithMemory(message, context);
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Add AI response
        const response = formatAIResponse(contentIdeas, context);
        addMessage(response, 'ai');
        
        // Update usage and save
        incrementUsage();
        saveConversation();
        saveToMemory(`Generated ${contentIdeas.length} content ideas for: ${message}`, 'content_generation');
        
    } catch (error) {
        removeTypingIndicator(typingId);
        addMessage('Request processing encountered an issue. Please refine your parameters and retry.', 'ai');
    }
    
    isGenerating = false;
    updateAIStatus('Ready', false);
}

function sendQuickPrompt(prompt) {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }
    
    document.getElementById('chatInput').value = prompt;
    sendMessage();
}

function showLimitWarning() {
    const conversation = document.getElementById('conversation');
    const warningDiv = document.createElement('div');
    warningDiv.className = 'limit-warning';
    warningDiv.innerHTML = `
        ⚠️ You've reached your daily limit. 
        <a href="#" onclick="showUpgradeModal()" style="color: #ff6b35; text-decoration: underline;">Upgrade now</a> 
        for unlimited access.
    `;
    
    conversation.appendChild(warningDiv);
    conversation.scrollTop = conversation.scrollHeight;
    
    setTimeout(() => warningDiv.remove(), 5000);
}

async function generateContentWithMemory(message, context) {
    updateAIStatus('Analyzing request • Researching web data', true);
    
    // Use memory to provide context
    const relevantMemory = userMemory
        .filter(item => item.type === 'content_generation')
        .slice(-5); // Use last 5 content generations for context
        
    // Generate content ideas (enhanced with memory context)
    const ideas = [];
    
    for (let i = 0; i < 6; i++) {
        ideas.push({
            title: generateTitleWithMemory(context, i, relevantMemory),
            content: generateContentWithMemory(context, i, relevantMemory),
            hashtags: generateHashtags(context, i),
            type: context.contentType || 'post',
            platform: context.platform || 'multi-platform',
            engagement: `Est. ${Math.floor(Math.random() * 50 + 10)}K+ reach`,
            source: 'ai_with_memory'
        });
    }
    
    return ideas;
}

function generateTitleWithMemory(context, index, memory) {
    const titleTemplates = [
        `${context.topic}: Strategic content framework`,
        `${context.topic} dominance on ${context.platform || 'social platforms'}`,
        `High-converting ${context.topic} strategies`,
        `${context.topic}: Industry insights & tactics`,
        `Executive guide to ${context.topic} for ${context.audience || 'target demographics'}`,
        `${context.topic}: Performance-driven approach`
    ];
    
    // Enhanced with memory context
    if (memory.length > 0 && Math.random() > 0.5) {
        return `Advanced ${context.topic} strategies (building on previous insights)`;
    }
    
    return titleTemplates[index % titleTemplates.length];
}

function generateContentWithMemory(context, index, memory) {
    const contentTemplates = [
        `Market analysis reveals ${context.topic} drives measurable engagement for ${context.audience || 'target audiences'}.`,
        `Strategic implementation of ${context.topic} increases conversion rates by up to 340% across platforms.`,
        `Data indicates ${context.topic} content outperforms standard formats by significant margins.`,
        `Professional analysis: ${context.topic} represents critical competitive advantage in 2025.`,
        `Leading brands leverage ${context.topic} for authentic audience connection and retention.`,
        `Performance metrics confirm ${context.topic} generates superior engagement compared to traditional approaches.`
    ];
    
    // Enhanced with memory
    if (memory.length > 0) {
        return `Building on our previous discussions, ${contentTemplates[index % contentTemplates.length].toLowerCase()}`;
    }
    
    return contentTemplates[index % contentTemplates.length];
}

function parseUserIntent(message) {
    const context = {
        topic: null,
        platform: null,
        contentType: null,
        audience: null,
        tone: null
    };
    
    const lowerMessage = message.toLowerCase();
    
    // Extract topic
    const topicMatches = lowerMessage.match(/about\s+([^,\.!?]+)/i) || 
                       lowerMessage.match(/for\s+([^,\.!?]+)/i);
    if (topicMatches) {
        context.topic = topicMatches[1].trim();
    }
    
    // Platform detection (simplified for space)
    if (lowerMessage.includes('instagram') || lowerMessage.includes('ig')) context.platform = 'instagram';
    if (lowerMessage.includes('tiktok')) context.platform = 'tiktok';
    if (lowerMessage.includes('linkedin')) context.platform = 'linkedin';
    if (lowerMessage.includes('twitter')) context.platform = 'twitter';
    
    return context;
}

function addMessage(content, type) {
    const conversation = document.getElementById('conversation');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="message-avatar">${currentUser?.name?.charAt(0).toUpperCase() || 'U'}</div>
            <div class="message-content">
                ${content}
                <div class="message-time">${time}</div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                ${content}
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    
    // Remove welcome message if it exists
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
}

function saveConversation() {
    if (!isLoggedIn) return;
    
    const messages = Array.from(document.querySelectorAll('.message')).map(msg => ({
        type: msg.classList.contains('user') ? 'user' : 'ai',
        content: msg.querySelector('.message-content').textContent.replace(/\d{1,2}:\d{2}/, '').trim(),
        timestamp: Date.now()
    }));
    
    conversationHistory = messages;
    localStorage.setItem(`conversations_${currentUser.id}`, JSON.stringify(messages));
}

function restoreConversation() {
    const conversation = document.getElementById('conversation');
    
    // Clear welcome message
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) welcomeMsg.remove();
    
    conversationHistory.forEach(msg => {
        addMessage(msg.content, msg.type);
    });
}

function formatAIResponse(contentIdeas, context) {
    let response = `Generated ${contentIdeas.length} strategic content concepts`;
    
    if (context.platform) {
        response += ` optimized for ${context.platform.charAt(0).toUpperCase() + context.platform.slice(1)}`;
    }
    if (context.topic) {
        response += ` focusing on ${context.topic}`;
    }
    
    response += '. Click any card to copy:';
    
    const contentCards = contentIdeas.map(idea => `
        <div class="content-card" onclick="copyContent('${idea.title}', '${idea.content}', '${idea.hashtags}')">
            <div class="card-header">
                <span class="card-type">${idea.type}</span>
                <span class="card-platform">${idea.platform}</span>
            </div>
            <div class="card-title">${idea.title}</div>
            <div class="card-content">${idea.content}</div>
            <div class="card-hashtags">${idea.hashtags}</div>
            <div class="card-metrics">
                <span>${idea.engagement}</span>
                <span>Click to copy</span>
            </div>
        </div>
    `).join('');
    
    return `${response}<div class="content-results">${contentCards}</div>`;
}

function generateHashtags(context, index) {
    const baseHashtags = [`#${context.topic?.replace(/\s+/g, '') || 'Content'}`];
    const platformHashtags = {
        instagram: ['#InstagramMarketing', '#ContentCreator', '#SocialMedia'],
        tiktok: ['#TikTokTrends', '#Viral', '#ForYou'],
        linkedin: ['#ProfessionalGrowth', '#BusinessTips', '#Leadership'],
        twitter: ['#TwitterChat', '#SocialMediaMarketing', '#DigitalMarketing']
    };
    
    const platform = context.platform || 'instagram';
    return [...baseHashtags, ...platformHashtags[platform] || platformHashtags.instagram].join(' ');
}

function showTypingIndicator() {
    const conversation = document.getElementById('conversation');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span>Analyzing request • Researching web data</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    
    conversation.appendChild(typingDiv);
    conversation.scrollTop = conversation.scrollHeight;
    return 'typing-indicator';
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) indicator.remove();
}

function copyContent(title, content, hashtags) {
    const text = `${title}\n\n${content}\n\n${hashtags}`;
    navigator.clipboard.writeText(text);
    
    // Visual feedback
    event.currentTarget.style.borderColor = '#00ff88';
    setTimeout(() => {
        event.currentTarget.style.borderColor = '#444';
    }, 1000);
    
    // Save to memory
    saveToMemory(`User copied content: ${title}`, 'content_copy');
}

// Input handling
document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
document.getElementById('chatInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.user-menu')) {
        document.getElementById('dropdownMenu').classList.remove('show');
    }
});

// Initialize app on load
window.addEventListener('load', initializeApp);
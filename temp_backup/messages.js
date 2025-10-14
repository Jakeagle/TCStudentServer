/**
 * Messages System for Trinity Capital
 * Handles teacher-student messaging - simplified version
 */

import { currentProfile } from './script.js';
import { showNotification } from './validation.js';

// Note: Lesson tracking import removed - simplified messaging system

// Messages system state
let messagesState = {
  currentConversation: null,
  conversations: [],
  isModalOpen: false,
};

// Initialize messages system
export function initializeMessages() {
  console.log('🔧 Initializing Messages system...');

  // Add event listener for messages button
  const messagesBTN = document.querySelector('.messagesBTN');
  if (messagesBTN) {
    messagesBTN.addEventListener('click', openMessagesModal);
    console.log('✅ Messages button listener added');
  }

  // Add event listener for close button
  const closeBtn = document.querySelector('.close-messages-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMessagesModal);
  }

  // Add event listener for new conversation button
  const newThreadBtn = document.querySelector('.new-thread-button');
  if (newThreadBtn) {
    newThreadBtn.addEventListener('click', startNewConversation);
  }

  // Initialize with teacher conversation
  initializeTeacherConversation();

  console.log('✅ Messages system initialized');
}

// Open the messages modal
function openMessagesModal() {
  console.log('📧 Opening messages modal...');

  const modal = document.querySelector('.messagesModal');
  if (!modal) {
    console.error('❌ Messages modal not found');
    return;
  }

  messagesState.isModalOpen = true;
  modal.showModal();

  // Load conversations
  loadConversations();

  // Auto-select teacher conversation if available
  if (messagesState.conversations.length > 0) {
    selectConversation(messagesState.conversations[0]);
  }
}

// Close the messages modal
function closeMessagesModal() {
  console.log('📧 Closing messages modal...');

  const modal = document.querySelector('.messagesModal');
  if (modal) {
    modal.close();
    messagesState.isModalOpen = false;
  }
}

// Initialize teacher conversation
function initializeTeacherConversation() {
  const teacherConversation = {
    id: 'teacher',
    name: 'admin@trinity-capital.net',
    type: 'teacher',
    messages: [
      {
        id: 1,
        sender: 'teacher',
        content:
          "Welcome to Trinity Capital! I'm here to help you with your lessons. Feel free to send me your answers and questions.",
        timestamp: new Date(),
        isRead: true,
      },
    ],
    lastActivity: new Date(),
  };

  messagesState.conversations = [teacherConversation];
}

// Load conversations into the UI
function loadConversations() {
  const threadList = document.querySelector('.thread-list');
  if (!threadList) return;

  threadList.innerHTML = '';

  messagesState.conversations.forEach(conversation => {
    const threadItem = document.createElement('li');
    threadItem.className = 'thread-item';
    threadItem.innerHTML = `
      <div class="thread-info">
        <h4 class="thread-name">${conversation.name}</h4>
        <p class="thread-preview">${getLastMessagePreview(conversation)}</p>
        <span class="thread-time">${formatTime(conversation.lastActivity)}</span>
      </div>
    `;

    threadItem.addEventListener('click', () =>
      selectConversation(conversation),
    );
    threadList.appendChild(threadItem);
  });
}

// Get preview of last message
function getLastMessagePreview(conversation) {
  if (conversation.messages.length === 0) return 'No messages';

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return lastMessage.content.length > 50
    ? lastMessage.content.substring(0, 50) + '...'
    : lastMessage.content;
}

// Format timestamp
function formatTime(timestamp) {
  const now = new Date();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';

  return timestamp.toLocaleDateString();
}

// Select a conversation
function selectConversation(conversation) {
  console.log('📧 Selecting conversation:', conversation.name);

  messagesState.currentConversation = conversation;

  // Update header
  const header = document.querySelector('.conversation-with');
  if (header) {
    header.textContent = `Conversation with ${conversation.name}`;
  }

  // Load messages
  loadMessages(conversation);

  // Show conversation view
  showConversationView();
}

// Load messages for a conversation
function loadMessages(conversation) {
  const conversationBody = document.querySelector('.conversation-body');
  if (!conversationBody) return;

  // Clear existing messages
  conversationBody.innerHTML = '';

  // Add messages
  conversation.messages.forEach(message => {
    const messageElement = createMessageElement(message);
    conversationBody.appendChild(messageElement);
  });

  // Add compose area
  const composeArea = createComposeArea();
  conversationBody.appendChild(composeArea);

  // Scroll to bottom
  conversationBody.scrollTop = conversationBody.scrollHeight;
}

// Create message element
function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.sender === 'student' ? 'message-sent' : 'message-received'}`;

  messageDiv.innerHTML = `
    <div class="message-content">
      <p class="message-text">${message.content}</p>
      <span class="message-time">${formatTime(message.timestamp)}</span>
    </div>
  `;

  return messageDiv;
}

// Create compose area
function createComposeArea() {
  const composeDiv = document.createElement('div');
  composeDiv.className = 'compose-area';

  composeDiv.innerHTML = `
    <div class="compose-container">
      <textarea 
        class="compose-input" 
        placeholder="Type your message to the teacher..."
        rows="3"
      ></textarea>
      <div class="compose-actions">
        <button class="compose-send" type="button">
          <i class="fa-solid fa-paper-plane"></i>
          Send
        </button>
      </div>
    </div>
  `;

  // Add send functionality
  const sendBtn = composeDiv.querySelector('.compose-send');
  const textarea = composeDiv.querySelector('.compose-input');

  sendBtn.addEventListener('click', () => sendMessage(textarea));
  textarea.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(textarea);
    }
  });

  return composeDiv;
}

// Send a message
function sendMessage(textarea) {
  const content = textarea.value.trim();
  if (!content) return;

  if (!messagesState.currentConversation) {
    showNotification('Please select a conversation first', 'error');
    return;
  }

  console.log('📧 Sending message:', content);

  // Create message object
  const message = {
    id: Date.now(),
    sender: 'student',
    content: content,
    timestamp: new Date(),
    isRead: false,
  };

  // Add to conversation
  messagesState.currentConversation.messages.push(message);
  messagesState.currentConversation.lastActivity = new Date();

  // Clear textarea
  textarea.value = '';

  // Reload messages
  loadMessages(messagesState.currentConversation);

  // Show success notification
  showNotification('Message sent to teacher!', 'success');

  // Note: Lesson tracking removed - simplified messaging

  // Simulate teacher response after a short delay
  setTimeout(() => {
    simulateTeacherResponse(content);
  }, 2000);
}

// Simulate teacher response
function simulateTeacherResponse(studentMessage) {
  if (
    !messagesState.currentConversation ||
    messagesState.currentConversation.id !== 'teacher'
  )
    return;

  // Generate appropriate response based on student message
  let response = 'Thank you for your message! ';

  if (
    studentMessage.toLowerCase().includes('spending') ||
    studentMessage.toLowerCase().includes('categories')
  ) {
    response +=
      'Great work on setting up your spending categories! This will help you track your expenses effectively.';
  } else if (
    studentMessage.toLowerCase().includes('goal') ||
    studentMessage.toLowerCase().includes('save')
  ) {
    response +=
      'Excellent SMART goal! Setting specific savings targets is a key financial skill.';
  } else if (
    studentMessage.toLowerCase().includes('assets') ||
    studentMessage.toLowerCase().includes('liabilities')
  ) {
    response +=
      'Well done identifying your assets and liabilities! Understanding your net worth is fundamental to financial planning.';
  } else if (
    studentMessage.toLowerCase().includes('transaction') ||
    studentMessage.toLowerCase().includes('balance')
  ) {
    response +=
      'Perfect! Reconciling transactions is an important skill for managing your finances.';
  } else if (
    studentMessage.toLowerCase().includes('budget') ||
    studentMessage.toLowerCase().includes('income')
  ) {
    response +=
      'Outstanding work on your budget! The 50/30/20 rule is a great framework for financial success.';
  } else {
    response +=
      "I can see you're working hard on the lesson activities. Keep up the great work!";
  }

  const teacherMessage = {
    id: Date.now() + 1,
    sender: 'teacher',
    content: response,
    timestamp: new Date(),
    isRead: true,
  };

  messagesState.currentConversation.messages.push(teacherMessage);
  messagesState.currentConversation.lastActivity = new Date();

  // Reload messages if modal is still open
  if (messagesState.isModalOpen) {
    loadMessages(messagesState.currentConversation);
  }
}

// Start new conversation
function startNewConversation() {
  // For now, just show teacher conversation
  // In the future, could add support for multiple teachers or peer messaging
  if (messagesState.conversations.length > 0) {
    selectConversation(messagesState.conversations[0]);
  }
}

// Show conversation view
function showConversationView() {
  const conversationView = document.querySelector('.conversation-view');
  if (conversationView) {
    conversationView.style.display = 'block';
  }
}

// Export functions for global access
window.initializeMessages = initializeMessages;
window.openMessagesModal = openMessagesModal;
window.closeMessagesModal = closeMessagesModal;

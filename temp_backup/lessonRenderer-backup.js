/**
 * Trinity Capital - Lesson Renderer
 *
 * This module handles pulling and rendering lesson content from MongoDB Atlas DB.
 * It follows the architecture plan for lesson content rendering with proper
 * grouping of headers and text blocks.
 *
 * Key Features:
 * - Pulls lesson content from MongoDB
 * - Groups headers + text blocks appropriately
 * - Handles consecutive headers independently
 * - Manages lesson gating and progression
 * - Integrates with lesson engine for dynamic content
 */

class LessonRenderer {
  constructor() {
    this.currentStudent = null;
    this.currentLesson = null;
    this.renderedContent = null;
    this.contentContainer = null;

    console.log('📖 Trinity Capital Lesson Renderer initialized');
  }

  /**
   * Initialize the renderer for a specific student
   * @param {string} studentId - The student's ID
   * @param {string} containerId - DOM container ID for rendering content
   */
  initialize(studentId, containerId = 'lesson-content') {
    this.currentStudent = studentId;

    // Try to find the specified container, or look for LessonsBlock class
    this.contentContainer = document.getElementById(containerId);

    if (!this.contentContainer) {
      console.log(
        `📝 Content container '${containerId}' not found, checking for lessonsBlock...`,
      );

      // Look for the lessonsBlock class container (with correct lowercase)
      const lessonsBlock = document.querySelector('.lessonsBlock');
      if (lessonsBlock) {
        // Use the existing lessonsBlock container
        this.contentContainer = lessonsBlock;
        console.log(
          `📚 Using existing lessonsBlock container for lesson content`,
        );
      } else if (containerId === 'lesson-content') {
        // Create the lesson-content div inside the lesson modal or main area
        const lessonModal = document.querySelector('.lessonModal');
        const targetContainer =
          lessonModal ||
          document.querySelector('.mainContent') ||
          document.querySelector('.rightSide') ||
          document.body;

        this.contentContainer = document.createElement('div');
        this.contentContainer.id = 'lesson-content';
        this.contentContainer.className =
          'lesson-content-container LessonsBlock';
        this.contentContainer.style.display = 'none'; // Hidden by default
        targetContainer.appendChild(this.contentContainer);
        console.log(
          `📚 Created lesson-content container with LessonsBlock class`,
        );
      } else {
        // Create a container in the main content area
        const mainContent =
          document.querySelector('.mainContent') ||
          document.querySelector('.rightSide') ||
          document.body;
        this.contentContainer = document.createElement('div');
        this.contentContainer.id = containerId;
        this.contentContainer.className = 'lesson-content-container';
        this.contentContainer.style.display = 'none'; // Hidden by default
        mainContent.appendChild(this.contentContainer);
        console.log(`📚 Created ${containerId} container in main content area`);
      }
    }

    console.log(`📚 Lesson Renderer initialized for student: ${studentId}`);
    return true;
  }

  /**
   * Render a specific lesson by ID
   * @param {string} lessonId - The lesson ID to render
   */
  async renderLesson(lessonId) {
    try {
      console.log(`🔄 Loading lesson: ${lessonId}`);

      // Check if student can access this lesson (gating)
      const canAccess = await this.checkLessonAccess(lessonId);
      if (!canAccess) {
        this.renderAccessDenied(lessonId);
        return;
      }

      // Fetch lesson data from MongoDB
      const lessonData = await this.fetchLessonData(lessonId);
      if (!lessonData) {
        this.renderLessonNotFound(lessonId);
        return;
      }

      this.currentLesson = lessonData;

      // Render lesson content
      await this.renderLessonContent(lessonData);

      // Initialize lesson engine for this lesson
      if (window.lessonEngine) {
        await window.lessonEngine.initialize(this.currentStudent);
      }

      console.log(
        `✅ Lesson rendered successfully: ${lessonData.lesson_title}`,
      );
    } catch (error) {
      console.error('❌ Error rendering lesson:', error);
      this.renderError(error.message);
    }
  }

  /**
   * Fetch lesson data from the server/MongoDB
   * @param {string} lessonId - The lesson ID
   */
  async fetchLessonData(lessonId) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/lesson/${lessonId}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch lesson: ${response.status}`);
      }

      const lessonData = await response.json();
      return lessonData;
    } catch (error) {
      console.error('❌ Error fetching lesson data:', error);
      return null;
    }
  }

  /**
   * Check if student has access to a specific lesson (lesson gating)
   * @param {string} lessonId - The lesson ID to check
   */
  async checkLessonAccess(lessonId) {
    try {
      const encodedStudentId = encodeURIComponent(this.currentStudent);
      const response = await fetch(
        `http://localhost:3000/api/lesson-access/${encodedStudentId}/${lessonId}`,
      );

      if (response.ok) {
        const accessData = await response.json();
        return accessData.hasAccess;
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking lesson access:', error);
      return false;
    }
  }

  /**
   * Render the main lesson content according to architecture rules
   * @param {Object} lessonData - The lesson data from MongoDB
   */
  async renderLessonContent(lessonData) {
    // Clear existing content
    this.contentContainer.innerHTML = '';

    // Create lesson header
    this.renderLessonHeader(lessonData);

    // Process and render content blocks
    const contentBlocks = this.processContentBlocks(lessonData.content || []);
    this.renderContentBlocks(contentBlocks);

    // Render lesson instructions if available
    if (
      lessonData.lesson_conditions &&
      lessonData.lesson_conditions.length > 0
    ) {
      this.renderInstructions(lessonData);
    }

    // Add lesson navigation
    this.renderLessonNavigation(lessonData);
  }

  /**
   * Process content blocks according to architecture rules:
   * - Headers + text blocks are grouped
   * - Multiple text blocks with no header appear standalone
   * - Consecutive headers render independently
   */
  processContentBlocks(content) {
    const processedBlocks = [];
    let currentGroup = null;

    for (let i = 0; i < content.length; i++) {
      const block = content[i];

      if (block.type === 'header') {
        // If we have a current group, finalize it
        if (currentGroup) {
          processedBlocks.push(currentGroup);
        }

        // Check if next block is also a header (consecutive headers)
        const nextBlock = content[i + 1];
        if (nextBlock && nextBlock.type === 'header') {
          // Render this header independently
          processedBlocks.push({
            type: 'standalone_header',
            content: [block],
          });
          currentGroup = null;
        } else {
          // Start new group with this header
          currentGroup = {
            type: 'header_group',
            content: [block],
          };
        }
      } else if (block.type === 'text') {
        if (currentGroup && currentGroup.type === 'header_group') {
          // Add to current header group
          currentGroup.content.push(block);
        } else {
          // Standalone text block or group with other text blocks
          if (!currentGroup || currentGroup.type !== 'text_group') {
            if (currentGroup) {
              processedBlocks.push(currentGroup);
            }
            currentGroup = {
              type: 'text_group',
              content: [],
            };
          }
          currentGroup.content.push(block);
        }
      } else {
        // Other content types (images, videos, etc.)
        if (currentGroup) {
          processedBlocks.push(currentGroup);
          currentGroup = null;
        }

        processedBlocks.push({
          type: 'standalone_content',
          content: [block],
        });
      }
    }

    // Add final group if exists
    if (currentGroup) {
      processedBlocks.push(currentGroup);
    }

    return processedBlocks;
  }

  /**
   * Render processed content blocks
   */
  renderContentBlocks(blocks) {
    blocks.forEach(block => {
      const blockElement = this.createBlockElement(block);
      this.contentContainer.appendChild(blockElement);
    });
  }

  /**
   * Create DOM element for a content block
   */
  createBlockElement(block) {
    const container = document.createElement('div');
    container.className = `lesson-block lesson-${block.type}`;

    switch (block.type) {
      case 'header_group':
        this.renderHeaderGroup(container, block.content);
        break;
      case 'text_group':
        this.renderTextGroup(container, block.content);
        break;
      case 'standalone_header':
        this.renderStandaloneHeader(container, block.content[0]);
        break;
      case 'standalone_content':
        this.renderStandaloneContent(container, block.content[0]);
        break;
    }

    return container;
  }

  /**
   * Render header group (header + associated text blocks)
   */
  renderHeaderGroup(container, content) {
    content.forEach(item => {
      if (item.type === 'header') {
        const header = document.createElement(`h${item.level || 2}`);
        header.textContent = item.text;
        header.className = 'lesson-header';
        container.appendChild(header);
      } else if (item.type === 'text') {
        const text = document.createElement('p');
        text.innerHTML = this.processTextContent(item.text);
        text.className = 'lesson-text';
        container.appendChild(text);
      }
    });
  }

  /**
   * Render text group (multiple text blocks without headers)
   */
  renderTextGroup(container, content) {
    content.forEach(item => {
      const text = document.createElement('p');
      text.innerHTML = this.processTextContent(item.text);
      text.className = 'lesson-text standalone';
      container.appendChild(text);
    });
  }

  /**
   * Render standalone header (consecutive headers)
   */
  renderStandaloneHeader(container, headerContent) {
    const header = document.createElement(`h${headerContent.level || 2}`);
    header.textContent = headerContent.text;
    header.className = 'lesson-header standalone';
    container.appendChild(header);
  }

  /**
   * Render standalone content (images, videos, etc.)
   */
  renderStandaloneContent(container, content) {
    switch (content.type) {
      case 'image':
        const img = document.createElement('img');
        img.src = content.src;
        img.alt = content.alt || '';
        img.className = 'lesson-image';
        container.appendChild(img);
        break;
      case 'video':
        const video = document.createElement('video');
        video.src = content.src;
        video.controls = true;
        video.className = 'lesson-video';
        container.appendChild(video);
        break;
      default:
        const div = document.createElement('div');
        div.innerHTML = this.processTextContent(content.text || '');
        container.appendChild(div);
    }
  }

  /**
   * Process text content for formatting and dynamic content
   */
  processTextContent(text) {
    if (!text) return '';

    // Basic markdown-style formatting
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Process dynamic placeholders
    text = this.processDynamicPlaceholders(text);

    return text;
  }

  /**
   * Process dynamic placeholders in lesson content
   */
  processDynamicPlaceholders(text) {
    // Replace student-specific placeholders
    if (this.currentStudent) {
      text = text.replace(/\{studentName\}/g, this.currentStudent);
    }

    // Replace lesson-specific placeholders
    if (this.currentLesson) {
      text = text.replace(
        /\{lessonTitle\}/g,
        this.currentLesson.lesson_title || '',
      );
      text = text.replace(/\{unitNumber\}/g, this.currentLesson.unit || '');
    }

    return text;
  }

  /**
   * Render lesson header with title and metadata
   */
  renderLessonHeader(lessonData) {
    const header = document.createElement('div');
    header.className = 'lesson-header-section';

    const title = document.createElement('h1');
    title.textContent = lessonData.lesson_title;
    title.className = 'lesson-title';

    const metadata = document.createElement('div');
    metadata.className = 'lesson-metadata';

    if (lessonData.unit) {
      const unit = document.createElement('span');
      unit.textContent = `Unit ${lessonData.unit}`;
      unit.className = 'lesson-unit';
      metadata.appendChild(unit);
    }

    if (lessonData.estimated_duration) {
      const duration = document.createElement('span');
      duration.textContent = `${lessonData.estimated_duration} minutes`;
      duration.className = 'lesson-duration';
      metadata.appendChild(duration);
    }

    header.appendChild(title);
    header.appendChild(metadata);
    this.contentContainer.appendChild(header);
  }

  /**
   * Generate and render personalized instructions based on lesson conditions
   */
  renderInstructions(lessonData) {
    const instructionsContainer = document.createElement('div');
    instructionsContainer.className = 'lesson-instructions';
    instructionsContainer.id = 'lesson-instructions';

    const instructionsTitle = document.createElement('h3');
    instructionsTitle.textContent = 'Your Tasks';
    instructionsTitle.className = 'instructions-title';

    const instructionsList = document.createElement('ul');
    instructionsList.className = 'instructions-list';

    // Generate instructions from lesson conditions
    const instructions = this.generateInstructions(
      lessonData.lesson_conditions,
    );

    instructions.forEach((instruction, index) => {
      const listItem = document.createElement('li');
      listItem.innerHTML = instruction;
      listItem.className = 'instruction-item';
      listItem.dataset.conditionIndex = index;
      instructionsList.appendChild(listItem);
    });

    instructionsContainer.appendChild(instructionsTitle);
    instructionsContainer.appendChild(instructionsList);
    this.contentContainer.appendChild(instructionsContainer);
  }

  /**
   * Generate personalized instructions from lesson conditions
   */
  generateInstructions(conditions) {
    const instructions = [];

    conditions.forEach(condition => {
      const instruction = this.conditionToInstruction(condition);
      if (instruction) {
        instructions.push(instruction);
      }
    });

    return instructions;
  }

  /**
   * Convert a lesson condition to a user-friendly instruction
   */
  conditionToInstruction(condition) {
    const templates = {
      transfer_completed:
        'Make a transfer between your checking and savings accounts',
      deposit_completed: 'Make a deposit using the check deposit feature',
      bill_created: 'Set up a recurring bill payment',
      savings_balance_above: `Save at least $${condition.value} in your savings account`,
      goal_set_specific:
        'Set a specific financial goal with clear action steps',
      budget_positive_above: `Maintain a positive budget with at least $${condition.value} surplus`,
      transfer_amount_above: `Make a transfer of at least $${condition.value}`,
      message_sent: 'Send a message to a classmate or teacher',
    };

    const baseInstruction = templates[condition.condition_type];

    if (!baseInstruction) {
      return null;
    }

    // Add action-specific context if available
    if (condition.action && condition.action.description) {
      return `${baseInstruction} - ${condition.action.description}`;
    }

    return baseInstruction;
  }

  /**
   * Render lesson navigation (previous/next lesson buttons)
   */
  renderLessonNavigation(lessonData) {
    const navigation = document.createElement('div');
    navigation.className = 'lesson-navigation';

    // Previous lesson button (if applicable)
    if (lessonData.previousLessonId) {
      const prevButton = document.createElement('button');
      prevButton.textContent = '← Previous Lesson';
      prevButton.className = 'nav-button prev-lesson';
      prevButton.onclick = () => this.renderLesson(lessonData.previousLessonId);
      navigation.appendChild(prevButton);
    }

    // Next lesson button (if accessible)
    if (lessonData.nextLessonId) {
      const nextButton = document.createElement('button');
      nextButton.textContent = 'Next Lesson →';
      nextButton.className = 'nav-button next-lesson';
      nextButton.onclick = () =>
        this.checkAndNavigateNext(lessonData.nextLessonId);
      navigation.appendChild(nextButton);
    }

    this.contentContainer.appendChild(navigation);
  }

  /**
   * Check lesson completion before allowing navigation to next lesson
   */
  async checkAndNavigateNext(nextLessonId) {
    const canAccess = await this.checkLessonAccess(nextLessonId);

    if (canAccess) {
      this.renderLesson(nextLessonId);
    } else {
      this.showGatingMessage();
    }
  }

  /**
   * Show message when lesson gating prevents access
   */
  showGatingMessage() {
    const message = `
            <div class="gating-message">
                <h3>🔒 Complete Current Lesson First</h3>
                <p>You need to complete all tasks in your current lesson before moving to the next one.</p>
                <p>Check your task list above and make sure you've completed all required activities.</p>
            </div>
        `;

    this.showModal(message);
  }

  /**
   * Render access denied message in a modal, not in the main content area
   */
  renderAccessDenied(lessonId) {
    const accessDeniedMessage = `
      <div class="access-denied" style="text-align: center; padding: 40px;">
        <h2 style="color: #e74c3c;">🔒 Access Denied</h2>
        <p>You don't have permission to access this lesson yet.</p>
        <p>Please complete the previous lessons first.</p>
        <button onclick="this.closest('.modal').style.display='none'" class="retry-button" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
      </div>
    `;

    // Show in modal instead of replacing main content
    this.showModal(accessDeniedMessage);
  }

  /**
   * Render lesson not found message in a modal, not in the main content area
   */
  renderLessonNotFound(lessonId) {
    const notFoundMessage = `
      <div class="lesson-not-found" style="text-align: center; padding: 40px;">
        <h2 style="color: #e74c3c;">📚 Lesson Not Found</h2>
        <p>The lesson with ID "${lessonId}" could not be found.</p>
        <button onclick="this.closest('.modal').style.display='none'" class="retry-button" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
      </div>
    `;

    // Show in modal instead of replacing main content
    this.showModal(notFoundMessage);
  }

  /**
   * Render error message
   */
  renderError(errorMessage) {
    this.contentContainer.innerHTML = `
            <div class="lesson-error">
                <h2>❌ Error Loading Lesson</h2>
                <p>There was an error loading the lesson: ${errorMessage}</p>
                <button onclick="window.location.reload()" class="retry-button">Try Again</button>
            </div>
        `;
  }

  /**
   * Show modal dialog
   */
  showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'lesson-modal';
    modal.innerHTML = `
            <div class="modal-content">
                ${content}
                <button class="modal-close" onclick="this.closest('.lesson-modal').remove()">×</button>
            </div>
        `;

    document.body.appendChild(modal);

    // Auto-close after 10 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 10000);
  }

  /**
   * Get available lessons for current student
   */
  async getAvailableLessons() {
    console.log(
      '🔥 getAvailableLessons called for student:',
      this.currentStudent,
    );
    try {
      const encodedStudentId = encodeURIComponent(this.currentStudent);
      const url = `http://localhost:3000/api/student-lessons/${encodedStudentId}`;
      console.log('🔥 Fetching lessons from URL:', url);

      const response = await fetch(url);
      console.log('🔥 Response status:', response.status, response.statusText);

      if (response.ok) {
        const lessons = await response.json();
        console.log('🔥 Received lessons:', lessons?.length, 'lessons');
        return lessons;
      } else {
        console.error(
          '❌ Failed to fetch lessons:',
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      console.error('❌ Error fetching available lessons:', error);
    }
    return [];
  }

  /**
   * Display the list of available lessons in the original circular button format
   * @param {Array} lessons - Array of lesson objects
   */
  displayLessonsList(lessons) {
    console.log(
      '🔥 displayLessonsList called with:',
      lessons?.length,
      'lessons',
    );
    console.log('🔥 contentContainer:', this.contentContainer);

    if (!this.contentContainer) {
      console.warn('⚠️ No content container found for displaying lessons');
      return;
    }

    console.log(`📚 Displaying ${lessons.length} lessons in the lessons block`);

    // Find the lesson header and update it with unit information
    const lessonHeader = this.contentContainer.querySelector('.lessonHeaderText');
    if (lessonHeader && lessons.length > 0) {
      const unitName = lessons[0].unitName || 'Unit 1: Earning and Spending';
      lessonHeader.textContent = unitName;
    }

    // Find the lesson row container
    const lessonRow = this.contentContainer.querySelector('.lessonRow');
    if (!lessonRow) {
      console.warn('⚠️ Could not find .lessonRow container');
      return;
    }

    // Clear existing lesson buttons
    lessonRow.innerHTML = '';

    // Add each lesson as a circular button
    lessons.forEach((lesson, index) => {
      const lessonButton = this.createCircularLessonButton(lesson, index);
      lessonRow.appendChild(lessonButton);
    });
  }

  /**
   * Create a circular lesson button in the original style
   * @param {Object} lesson - The lesson object
   * @param {number} index - The lesson index
   */
  createCircularLessonButton(lesson, index) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'col lesson-button-container';
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 10px;
      cursor: pointer;
    `;

    // Create circular button
    const circularButton = document.createElement('div');
    circularButton.className = 'lesson-circle-button';
    circularButton.style.cssText = `
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3498db, #2980b9);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
      margin-bottom: 10px;
    `;

    // Add lesson icon - use different icons based on lesson number
    const lessonNumber = index + 1;
    const icons = ['📚', '💰', '🏦', '📊', '💳', '🎯', '📈', '🎓'];
    const icon = icons[index % icons.length];
    
    circularButton.innerHTML = `
      <span style="font-size: 24px; color: white;">${icon}</span>
    `;

    // Add lesson title below the circle
    const lessonTitle = document.createElement('p');
    lessonTitle.className = 'lesson-title-text';
    lessonTitle.style.cssText = `
      text-align: center;
      font-size: 12px;
      font-weight: 500;
      margin: 0;
      max-width: 100px;
      line-height: 1.2;
      color: #2c3e50;
    `;
    lessonTitle.textContent = lesson.lesson_title || `Lesson ${lessonNumber}`;

    // Add click handler
    buttonContainer.addEventListener('click', () => {
      this.startLesson(lesson);
    });

    // Add hover effects
    buttonContainer.addEventListener('mouseenter', () => {
      circularButton.style.transform = 'scale(1.1)';
      circularButton.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.4)';
    });

    buttonContainer.addEventListener('mouseleave', () => {
      circularButton.style.transform = 'scale(1)';
      circularButton.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.3)';
    });

    // Add completion indicator if lesson is completed
    if (lesson.isCompleted) {
      const completionBadge = document.createElement('div');
      completionBadge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        width: 20px;
        height: 20px;
        background: #27ae60;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: white;
      `;
      completionBadge.innerHTML = '✓';
      buttonContainer.style.position = 'relative';
      buttonContainer.appendChild(completionBadge);
    }

    buttonContainer.appendChild(circularButton);
    buttonContainer.appendChild(lessonTitle);

    return buttonContainer;
  }

  /**
   * Start a specific lesson
   * @param {Object} lesson - The lesson object to start
   */
  startLesson(lesson) {
    console.log(`🚀 Starting lesson: ${lesson.lesson_title}`);

    // Initialize lesson engine with this lesson
    if (window.lessonEngine) {
      window.lessonEngine.currentLesson = lesson;
      console.log(`📚 Lesson engine loaded: ${lesson.lesson_title}`);

      // Show a notification that the lesson is starting
      if (window.showNotification) {
        window.showNotification(`Starting: ${lesson.lesson_title}`, 'info');
      }
    }

    // Render the lesson content
    this.renderLesson(lesson._id);
  }

  /**
   * Display a message when no lessons are available
   */
  displayNoLessonsMessage() {
    if (!this.contentContainer) return;

    const lessonRow = this.contentContainer.querySelector('.lessonRow');
    if (lessonRow) {
      lessonRow.innerHTML = `
        <div class="no-lessons-message" style="
          text-align: center;
          padding: 40px;
          color: #666;
          width: 100%;
        ">
          <h3>📚 No Lessons Available</h3>
          <p>You don't have any lessons assigned yet.</p>
          <p>Please contact your teacher to get lessons assigned to your account.</p>
        </div>
      `;
    }
  }

  /**
   * Display an error message when lessons fail to load
   */
  displayLessonsError() {
    if (!this.contentContainer) return;

    const lessonRow = this.contentContainer.querySelector('.lessonRow');
    if (lessonRow) {
      lessonRow.innerHTML = `
        <div class="lessons-error" style="
          text-align: center;
          padding: 40px;
          color: #dc3545;
          width: 100%;
        ">
          <h3>❌ Error Loading Lessons</h3>
          <p>There was a problem loading your lessons.</p>
          <p>Please refresh the page or contact support if the problem persists.</p>
        </div>
      `;
    }
  }
}

// Initialize global lesson renderer instance
window.lessonRenderer = new LessonRenderer();

/**
 * Main function called from script.js to render lessons for a student
 * This maintains compatibility with the existing system
 * @param {Object} studentProfile - The student's profile object
 */
export async function renderLessons(studentProfile) {
  console.log('🔥 renderLessons called with profile:', studentProfile);
  console.log('🔥 Available containers on page:', {
    'lessonsBlock': document.querySelector('.lessonsBlock'),
    'lesson-content': document.getElementById('lesson-content'),
    'LessonsBlock': document.querySelector('.LessonsBlock')
  });

  if (!studentProfile || !studentProfile.memberName) {
    console.warn('⚠️ Invalid student profile provided to renderLessons');
    return;
  }

  // Initialize the lesson renderer for this student
  console.log('🔥 Attempting to initialize lesson renderer...');
  const initialized = window.lessonRenderer.initialize(
    studentProfile.memberName,
    'lessonsBlock',
  );

  console.log('🔥 Initialization result:', initialized);

  if (!initialized) {
    console.warn('⚠️ Failed to initialize lesson renderer');
    return;
  }

  try {
    // Load all available lessons for this student
    console.log('🔍 Loading available lessons for student...');
    const availableLessons = await window.lessonRenderer.getAvailableLessons();

    if (availableLessons && availableLessons.length > 0) {
      console.log(
        `📚 Found ${availableLessons.length} lessons for ${studentProfile.memberName}`,
      );

      // Display the lessons list in the lessons block
      window.lessonRenderer.displayLessonsList(availableLessons);

      // Don't automatically render a specific lesson - let user choose from the list
      console.log(
        '📚 Lesson cards displayed. User can now select a lesson to start.',
      );
    } else {
      console.log('📝 No lessons found for student');
      window.lessonRenderer.displayNoLessonsMessage();
    }
  } catch (error) {
    console.error('❌ Error loading lessons:', error);
    window.lessonRenderer.displayLessonsError();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LessonRenderer, renderLessons };
}

console.log('✅ Trinity Capital Lesson Renderer loaded successfully');
    if (!this.contentContainer) {
      console.warn('⚠️ No content container found to display lessons');
      return;
    }

    console.log(`📋 Displaying ${lessons.length} lessons in lessons block`);

    // Create lessons list HTML
    const lessonsListHTML = `
      <div class="lessons-list">
        <h3>📚 Available Lessons</h3>
        <div class="lessons-grid">
          ${lessons
            .map(
              (lesson, index) => `
            <div class="lesson-card" data-lesson-id="${lesson._id}" onclick="window.lessonRenderer.selectLesson('${lesson._id}')">
              <div class="lesson-number">${index + 1}</div>
              <div class="lesson-content">
                <h4>${lesson.lesson_title}</h4>
                <p>${lesson.lesson_description}</p>
                <div class="lesson-meta">
                  <span class="lesson-type">${lesson.lesson_type}</span>
                  <span class="lesson-status ${lesson.isCompleted ? 'completed' : 'available'}">${lesson.isCompleted ? '✅ Completed' : '📚 Available'}</span>
                </div>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
      <style>
        .lessons-list {
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .lessons-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .lesson-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 20px;
          color: white;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .lesson-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        }
        .lesson-number {
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
        }
        .lesson-content {
          flex: 1;
        }
        .lesson-content h4 {
          margin: 0 0 8px 0;
          font-size: 18px;
        }
        .lesson-content p {
          margin: 0 0 12px 0;
          opacity: 0.9;
          font-size: 14px;
        }
        .lesson-meta {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .lesson-type, .lesson-status {
          background: rgba(255,255,255,0.2);
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          text-transform: capitalize;
        }
        .lesson-status.completed {
          background: rgba(76, 175, 80, 0.8);
        }
      </style>
    `;

    this.contentContainer.innerHTML = lessonsListHTML;
  }

  /**
   * Handle lesson selection
   * @param {string} lessonId - The selected lesson ID
   */
  selectLesson(lessonId) {
    console.log(`🎯 Lesson selected: ${lessonId}`);
    this.renderLesson(lessonId);
  }

  /**
   * Display a message when no lessons are available
   */
  displayNoLessonsMessage() {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = `
      <div class="no-lessons-message">
        <div class="message-content">
          <h3>📚 No Lessons Available</h3>
          <p>You don't have any lessons assigned yet. Please contact your teacher.</p>
        </div>
      </div>
      <style>
        .no-lessons-message {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          text-align: center;
          color: #666;
        }
        .message-content h3 {
          margin-bottom: 10px;
          color: #333;
        }
      </style>
    `;
  }

  /**
   * Display an error message when lessons fail to load
   */
  displayLessonsError() {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = `
      <div class="lessons-error">
        <div class="error-content">
          <h3>❌ Error Loading Lessons</h3>
          <p>There was a problem loading your lessons. Please try refreshing the page.</p>
          <button onclick="location.reload()" class="retry-button">🔄 Retry</button>
        </div>
      </div>
      <style>
        .lessons-error {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          text-align: center;
          color: #d32f2f;
        }
        .error-content h3 {
          margin-bottom: 10px;
        }
        .retry-button {
          margin-top: 15px;
          padding: 10px 20px;
          background: #1976d2;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .retry-button:hover {
          background: #1565c0;
        }
      </style>
    `;
  }

  /**
   * Update instruction completion status
   */
  markInstructionComplete(conditionIndex) {
    const instructionItem = document.querySelector(
      `[data-condition-index="${conditionIndex}"]`,
    );
    if (instructionItem) {
      instructionItem.classList.add('completed');
      instructionItem.innerHTML += ' ✅';
    }
  }

  /**
   * Refresh lesson content (useful for dynamic updates)
   */
  async refreshLesson() {
    if (this.currentLesson) {
      await this.renderLesson(this.currentLesson._id);
    }
  }
}

// Initialize global lesson renderer instance
window.lessonRenderer = new LessonRenderer();

/**
 * Main function called from script.js to render lessons for a student
 * This maintains compatibility with the existing system
 * @param {Object} studentProfile - The student's profile object
 */
export async function renderLessons(studentProfile) {
  console.log('� renderLessons called with profile:', studentProfile);
  console.log('🔥 Available containers on page:', {
    lessonsBlock: document.querySelector('.lessonsBlock'),
    'lesson-content': document.getElementById('lesson-content'),
    LessonsBlock: document.querySelector('.LessonsBlock'),
  });

  if (!studentProfile || !studentProfile.memberName) {
    console.warn('⚠️ Invalid student profile provided to renderLessons');
    return;
  }

  // Initialize the lesson renderer for this student
  console.log('🔥 Attempting to initialize lesson renderer...');
  const initialized = window.lessonRenderer.initialize(
    studentProfile.memberName,
    'lessonsBlock',
  );

  console.log('🔥 Initialization result:', initialized);

  if (!initialized) {
    console.warn('⚠️ Failed to initialize lesson renderer');
    return;
  }

  try {
    // Load all available lessons for this student
    console.log('🔍 Loading available lessons for student...');
    const availableLessons = await window.lessonRenderer.getAvailableLessons();

    if (availableLessons && availableLessons.length > 0) {
      console.log(
        `📚 Found ${availableLessons.length} lessons for ${studentProfile.memberName}`,
      );

      // Display the lessons list in the lessons block
      window.lessonRenderer.displayLessonsList(availableLessons);

      // Don't automatically render a specific lesson - let user choose from the list
      console.log(
        '📚 Lesson cards displayed. User can now select a lesson to start.',
      );
    } else {
      console.log('📝 No lessons found for student');
      window.lessonRenderer.displayNoLessonsMessage();
    }
  } catch (error) {
    console.error('❌ Error loading lessons:', error);
    window.lessonRenderer.displayLessonsError();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LessonRenderer, renderLessons };
}

console.log('✅ Trinity Capital Lesson Renderer loaded successfully');

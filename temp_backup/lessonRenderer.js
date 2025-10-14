'use strict';

// Import instruction templates for generating student instructions
import {
  getInstructionTemplate,
  hasInstructionTemplate,
  getAvailableConditionTypes,
} from './instructionTemplates.js';

/**
 * Trinity Capital - Lesson Renderer
 *
 * Clean implementation following architecture rules:
 * - Headers + text blocks are grouped
 * - Multiple text blocks with no header appear standalone
 * - Consecutive headers render independently
 * - Uses real lesson schema with content array
 * - Uses separated instruction templates for maintainability
 */

class LessonRenderer {
  constructor() {
    this.currentStudent = null;
    this.contentContainer = null;
    this.currentLesson = null;
  }

  /**
   * Initialize the lesson renderer for a specific student
   * @param {string} studentId - The student's ID
   * @param {string} containerId - The container element ID or class name
   */
  initialize(studentId, containerId = 'lesson-content') {
    this.currentStudent = studentId;

    // Try to find the specified container, or look for lessonsBlock class
    this.contentContainer = document.getElementById(containerId);

    if (!this.contentContainer) {
      console.log(
        `📝 Content container '${containerId}' not found, checking for lessonsBlock...`,
      );

      // Look for the lessonsBlock class container
      const lessonsBlock = document.querySelector('.lessonsBlock');
      if (lessonsBlock) {
        this.contentContainer = lessonsBlock;
        console.log(
          `📚 Using existing lessonsBlock container for lesson content`,
        );
      } else {
        // Create a new container
        const targetContainer =
          document.querySelector('.mainContent') ||
          document.querySelector('.rightSide') ||
          document.body;

        this.contentContainer = document.createElement('div');
        this.contentContainer.id = containerId;
        this.contentContainer.className = 'lesson-content-container';
        targetContainer.appendChild(this.contentContainer);
        console.log(`📚 Created new lesson-content container`);
      }
    }

    if (!this.contentContainer) {
      console.error(`❌ Could not find or create container: ${containerId}`);
      return false;
    }

    console.log(`✅ Lesson renderer initialized for ${studentId}`);
    return true;
  }

  /**
   * Fetch available lessons for the current student
   * @returns {Array} Array of lesson objects
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
   * Display lessons in the original circular button format
   * @param {Array} lessons - Array of lesson objects
   */
  displayLessonsList(lessons) {
    console.log(
      '🔥 displayLessonsList called with:',
      lessons?.length,
      'lessons',
    );

    if (!this.contentContainer) {
      console.warn('⚠️ No content container found for displaying lessons');
      return;
    }

    console.log(`📚 Displaying ${lessons.length} lessons in the lessons block`);

    // Find the lesson header and update it with unit information
    const lessonHeader =
      this.contentContainer.querySelector('.lessonHeaderText');
    if (lessonHeader && lessons.length > 0) {
      const unitName =
        lessons[0].unit ||
        lessons[0].unitName ||
        'Unit 1: Earning and Spending';
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
   * Create a modern circular lesson button
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
      margin: 15px;
      cursor: pointer;
      transition: transform 0.3s ease;
    `;

    // Determine lesson availability
    const isLessonAvailable = this.checkLessonAvailability(lesson, index);

    // Create circular button with modern styling
    const circularButton = document.createElement('div');
    circularButton.className = 'lesson-circle-button';

    let buttonStyles = '';
    if (lesson.isCompleted) {
      // Completed lesson - gradient green
      buttonStyles = `
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: linear-gradient(135deg, #27ae60, #2ecc71);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 8px 25px rgba(39, 174, 96, 0.3);
        margin-bottom: 12px;
        border: 3px solid rgba(255,255,255,0.2);
      `;
    } else if (isLessonAvailable) {
      // Available lesson - gradient blue
      buttonStyles = `
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3498db, #5dade2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 8px 25px rgba(52, 152, 219, 0.3);
        margin-bottom: 12px;
        border: 3px solid rgba(255,255,255,0.2);
      `;
    } else {
      // Locked lesson - gradient gray
      buttonStyles = `
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: linear-gradient(135deg, #95a5a6, #bdc3c7);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: not-allowed;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(149, 165, 166, 0.3);
        margin-bottom: 12px;
        border: 3px solid rgba(255,255,255,0.1);
      `;
    }

    circularButton.style.cssText = buttonStyles;

    // Add lesson icon
    const lessonNumber = index + 1;
    const icons = ['📚', '💰', '🏦', '📊', '💳', '🎯', '📈', '🎓', '💡', '🔍'];
    const icon = icons[index % icons.length];

    circularButton.innerHTML = `
      <span style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${icon}</span>
    `;

    // Add lesson title below the circle
    const lessonTitle = document.createElement('p');
    lessonTitle.className = 'lesson-title-text';
    lessonTitle.style.cssText = `
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      margin: 0;
      max-width: 110px;
      line-height: 1.3;
      color: #2c3e50;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    lessonTitle.textContent = lesson.lesson_title || `Lesson ${lessonNumber}`;

    // Add click handler for available lessons
    if (isLessonAvailable) {
      buttonContainer.addEventListener('click', () => {
        this.startLesson(lesson);
      });

      // Add hover effects
      buttonContainer.addEventListener('mouseenter', () => {
        circularButton.style.transform = 'scale(1.1) translateY(-5px)';
        circularButton.style.boxShadow = lesson.isCompleted
          ? '0 12px 35px rgba(39, 174, 96, 0.4)'
          : '0 12px 35px rgba(52, 152, 219, 0.4)';
      });

      buttonContainer.addEventListener('mouseleave', () => {
        circularButton.style.transform = 'scale(1) translateY(0)';
        circularButton.style.boxShadow = lesson.isCompleted
          ? '0 8px 25px rgba(39, 174, 96, 0.3)'
          : '0 8px 25px rgba(52, 152, 219, 0.3)';
      });
    }

    // Add completion indicator if lesson is completed
    if (lesson.isCompleted) {
      const completionBadge = document.createElement('div');
      completionBadge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        width: 25px;
        height: 25px;
        background: linear-gradient(135deg, #f39c12, #e67e22);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: white;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
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
   * Check if a lesson is available to the student
   * @param {Object} lesson - The lesson object
   * @param {number} index - The lesson index
   * @returns {boolean} Whether the lesson is available
   */
  checkLessonAvailability(lesson, index) {
    // First lesson is always available
    if (index === 0) return true;

    // For now, assume lessons are available in sequence
    // This would be enhanced with actual gating logic
    return true;
  }

  /**
   * Start a specific lesson - create modal that takes up the lessonsBlock
   * @param {Object} lesson - The lesson object to start
   */
  startLesson(lesson) {
    console.log(`🚀 Starting lesson: ${lesson.lesson_title}`);

    this.currentLesson = lesson;

    // Create modal overlay that covers the entire screen
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'lesson-modal-overlay';
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(5px);
    `;

    // Create the modal dialog
    const modalDialog = document.createElement('div');
    modalDialog.className = 'lesson-modal-dialog';
    modalDialog.style.cssText = `
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.3);
      overflow: hidden;
      position: relative;
      animation: modalSlideIn 0.4s ease-out;
    `;

    // Add animation keyframes
    if (!document.querySelector('#lesson-modal-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'lesson-modal-styles';
      styleSheet.textContent = `
        @keyframes modalSlideIn {
          from {
            transform: translateY(-50px) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes modalSlideOut {
          from {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          to {
            transform: translateY(-50px) scale(0.9);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styleSheet);
    }

    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'lesson-modal-header';
    modalHeader.style.cssText = `
      background: linear-gradient(135deg, #3498db, #2980b9);
      color: white;
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const modalTitle = document.createElement('h2');
    modalTitle.textContent = lesson.lesson_title || 'Lesson Content';
    modalTitle.style.cssText = `
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.className = 'lesson-modal-close';
    closeButton.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 50%;
      transition: background-color 0.3s ease;
      width: 35px;
      height: 35px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
    });

    closeButton.addEventListener('click', () => {
      this.closeModal(modalOverlay);
    });

    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);

    // Create modal body with scrollable content
    const modalBody = document.createElement('div');
    modalBody.className = 'lesson-modal-body';
    modalBody.style.cssText = `
      padding: 30px;
      max-height: calc(85vh - 120px);
      overflow-y: auto;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Add lesson content to modal body
    this.renderLessonHeader(modalBody, lesson);

    // Debug: Log lesson structure
    console.log('🔍 Lesson object structure:', lesson);
    console.log('🔍 Lesson content array:', lesson.content);
    console.log('🔍 Lesson blocks:', lesson.lesson_blocks);
    console.log('🔍 Intro text blocks:', lesson.intro_text_blocks);

    // Process and render lesson content according to architecture rules
    if (lesson.content && Array.isArray(lesson.content)) {
      console.log('✅ Rendering lesson content...');
      this.renderLessonContent(modalBody, lesson.content);
    } else if (lesson.lesson_blocks || lesson.intro_text_blocks) {
      console.log('✅ Converting lesson blocks to content format...');
      const convertedContent = this.convertLessonBlocksToContent(lesson);
      this.renderLessonContent(modalBody, convertedContent);
    } else {
      console.warn(
        '⚠️ No valid lesson content found. Creating sample content.',
      );
      // Create sample content if none exists
      this.renderSampleContent(modalBody, lesson);
    }

    // Add instructions section (final slide equivalent)
    this.renderInstructions(modalBody, lesson);

    // Assemble the modal
    modalDialog.appendChild(modalHeader);
    modalDialog.appendChild(modalBody);
    modalOverlay.appendChild(modalDialog);

    // Add the modal to the document body for full-screen coverage
    document.body.appendChild(modalOverlay);

    // Close modal when clicking outside
    modalOverlay.addEventListener('click', e => {
      if (e.target === modalOverlay) {
        this.closeModal(modalOverlay);
      }
    });

    // Close modal with Escape key
    const handleEscape = e => {
      if (e.key === 'Escape') {
        this.closeModal(modalOverlay);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Initialize lesson engine if available
    if (window.lessonEngine) {
      window.lessonEngine.currentLesson = lesson;
      console.log(`📚 Lesson engine loaded: ${lesson.lesson_title}`);
    }
  }

  /**
   * Close the lesson modal with animation
   * @param {Element} modalOverlay - The modal overlay element
   */
  closeModal(modalOverlay) {
    const modalDialog = modalOverlay.querySelector('.lesson-modal-dialog');

    if (modalDialog) {
      modalDialog.style.animation = 'modalSlideOut 0.3s ease-in forwards';
      modalOverlay.style.opacity = '0';

      setTimeout(() => {
        if (modalOverlay.parentNode) {
          modalOverlay.parentNode.removeChild(modalOverlay);
        }
      }, 300);
    } else {
      // Fallback: immediate removal
      if (modalOverlay.parentNode) {
        modalOverlay.parentNode.removeChild(modalOverlay);
      }
    }

    // Clear current lesson
    this.currentLesson = null;
    console.log('📚 Lesson modal closed');
  }

  /**
   * Render lesson header with modern styling
   * @param {Element} container - The container element
   * @param {Object} lesson - The lesson object
   */
  renderLessonHeader(container, lesson) {
    const header = document.createElement('div');
    header.className = 'lesson-header-section';
    header.style.cssText = `
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #3498db;
      position: relative;
    `;

    const title = document.createElement('h1');
    title.textContent = lesson.lesson_title;
    title.style.cssText = `
      color: #2c3e50;
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #3498db, #2980b9);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;

    const description = document.createElement('p');
    description.textContent = lesson.lesson_description || '';
    description.style.cssText = `
      color: #34495e;
      font-size: 1.2rem;
      margin-bottom: 15px;
      line-height: 1.6;
    `;

    const metadata = document.createElement('div');
    metadata.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-top: 15px;
    `;

    if (lesson.unit) {
      const unit = document.createElement('span');
      unit.textContent = lesson.unit;
      unit.style.cssText = `
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: 600;
      `;
      metadata.appendChild(unit);
    }

    if (lesson.estimated_duration) {
      const duration = document.createElement('span');
      duration.textContent = `${lesson.estimated_duration} minutes`;
      duration.style.cssText = `
        background: linear-gradient(135deg, #27ae60, #229954);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: 600;
      `;
      metadata.appendChild(duration);
    }

    header.appendChild(title);
    header.appendChild(description);
    header.appendChild(metadata);
    container.appendChild(header);
  }

  /**
   * Render lesson content according to architecture rules:
   * - Headers + text blocks are grouped
   * - Multiple text blocks with no header appear standalone
   * - Consecutive headers render independently
   * @param {Element} container - The container element
   * @param {Array} content - The content array from lesson data
   */
  renderLessonContent(container, content) {
    console.log(`📚 Processing ${content.length} content blocks`);

    // Process content blocks according to architecture rules
    const processedBlocks = this.processContentBlocks(content);

    // Render each processed block
    processedBlocks.forEach((block, index) => {
      const blockElement = this.createContentBlock(block, index);
      container.appendChild(blockElement);
    });
  }

  /**
   * Render sample lesson content when actual content is missing
   * @param {Element} container - The container element
   * @param {Object} lesson - The lesson object
   */
  renderSampleContent(container, lesson) {
    console.log('📚 Rendering sample content for lesson:', lesson.lesson_title);

    // Create sample content based on lesson title
    const sampleContent = [];

    if (lesson.lesson_title?.toLowerCase().includes('money personality')) {
      sampleContent.push(
        { type: 'header', content: 'Understanding Your Money Personality' },
        {
          type: 'text',
          content:
            'Everyone has a unique relationship with money that affects how they spend, save, and make financial decisions.',
        },
        {
          type: 'text',
          content:
            'Understanding your money personality helps you make better financial choices and develop healthy money habits.',
        },
        { type: 'header', content: 'Needs vs Wants' },
        {
          type: 'text',
          content:
            'Learning to differentiate between needs and wants is crucial for financial success.',
        },
        {
          type: 'text',
          content:
            'Needs are essential items required for survival and basic functioning, such as food, shelter, and clothing.',
        },
        {
          type: 'text',
          content:
            'Wants are desires that improve quality of life but are not essential for survival, such as entertainment, luxury items, and dining out.',
        },
        { type: 'header', content: 'Identifying Your Money Type' },
        {
          type: 'text',
          content:
            'Are you a spender who enjoys purchasing things, or a saver who prefers to accumulate money for the future?',
        },
        {
          type: 'text',
          content:
            'Understanding your natural tendencies helps you create a budget and financial plan that works with your personality.',
        },
        { type: 'header', content: 'Building Healthy Money Habits' },
        {
          type: 'text',
          content:
            'Regardless of your money personality, everyone can benefit from tracking expenses, setting financial goals, and making informed spending decisions.',
        },
      );
    } else {
      // Generic sample content
      sampleContent.push(
        { type: 'header', content: 'Lesson Overview' },
        {
          type: 'text',
          content:
            'This lesson will help you understand important financial concepts and develop practical money management skills.',
        },
        {
          type: 'text',
          content:
            'You will learn through interactive activities and real-world applications using the Trinity Capital banking system.',
        },
        { type: 'header', content: 'Key Learning Objectives' },
        {
          type: 'text',
          content:
            'By the end of this lesson, you will be able to apply financial concepts in practical situations.',
        },
        {
          type: 'text',
          content:
            'You will gain hands-on experience with banking tools and develop confidence in managing your finances.',
        },
      );
    }

    // Render the sample content using the same architecture rules
    this.renderLessonContent(container, sampleContent);
  }

  /**
   * Convert lesson_blocks and intro_text_blocks to content format
   * @param {Object} lesson - The lesson object
   * @returns {Array} Converted content array
   */
  convertLessonBlocksToContent(lesson) {
    const content = [];

    // Add intro text blocks first
    if (lesson.intro_text_blocks && Array.isArray(lesson.intro_text_blocks)) {
      lesson.intro_text_blocks.forEach(block => {
        if (block.type === 'intro') {
          content.push({ type: 'header', content: 'Welcome!' });
          content.push({ type: 'text', content: block.content });
        } else {
          content.push({ type: 'text', content: block.content });
        }
      });
    }

    // Create comprehensive lesson content based on the title and description
    if (lesson.lesson_title) {
      content.push({ type: 'header', content: 'Lesson Introduction' });
      content.push({
        type: 'text',
        content:
          lesson.lesson_description ||
          'This lesson will help you develop important financial skills.',
      });

      // Add lesson-specific content based on title
      if (lesson.lesson_title.toLowerCase().includes('money personality')) {
        content.push(
          { type: 'header', content: 'Understanding Your Money Personality' },
          {
            type: 'text',
            content:
              'Everyone has a unique relationship with money that affects how they spend, save, and make financial decisions.',
          },
          {
            type: 'text',
            content:
              'Your money personality influences whether you tend to be a spender or a saver, how you approach financial risks, and what motivates your financial decisions.',
          },
          { type: 'header', content: 'Needs vs Wants' },
          {
            type: 'text',
            content:
              'One of the most important financial skills is learning to differentiate between needs and wants.',
          },
          {
            type: 'text',
            content:
              'Needs are essential items required for survival and basic functioning: food, shelter, clothing, transportation, and healthcare.',
          },
          {
            type: 'text',
            content:
              'Wants are desires that improve quality of life but are not essential: entertainment, luxury items, dining out, premium brands, and hobby expenses.',
          },
          { type: 'header', content: 'Identifying Your Money Type' },
          {
            type: 'text',
            content:
              'Are you a spender who enjoys purchasing things and finds satisfaction in acquiring new items?',
          },
          {
            type: 'text',
            content:
              'Or are you a saver who prefers to accumulate money for future security and long-term goals?',
          },
          {
            type: 'text',
            content:
              'Understanding your natural tendencies helps you create a budget and financial plan that works with your personality rather than against it.',
          },
          { type: 'header', content: 'Analyzing Your Spending Patterns' },
          {
            type: 'text',
            content:
              'By reviewing your bank account and transaction history, you can identify patterns in your spending behavior.',
          },
          {
            type: 'text',
            content:
              'Look for categories where you spend the most money and determine whether these are needs or wants.',
          },
          {
            type: 'text',
            content:
              'This analysis will help you understand your money personality and make more informed financial decisions.',
          },
        );
      } else if (lesson.lesson_title.toLowerCase().includes('goal setting')) {
        content.push(
          { type: 'header', content: 'SMART Financial Goals' },
          {
            type: 'text',
            content:
              'Effective financial goals follow the SMART criteria: Specific, Measurable, Attainable, Realistic, and Time-based.',
          },
          {
            type: 'text',
            content:
              'Specific goals clearly define what you want to achieve. Instead of "save money," try "save for a $5,000 emergency fund."',
          },
          {
            type: 'text',
            content:
              "Measurable goals include concrete numbers so you can track progress and know when you've succeeded.",
          },
          { type: 'header', content: 'Setting Realistic Targets' },
          {
            type: 'text',
            content:
              'Attainable goals are challenging but achievable given your current financial situation and income.',
          },
          {
            type: 'text',
            content:
              'Realistic goals consider your other financial obligations and life circumstances.',
          },
          {
            type: 'text',
            content:
              'Time-based goals have clear deadlines that create urgency and help you stay focused.',
          },
        );
      } else if (lesson.lesson_title.toLowerCase().includes('budget')) {
        content.push(
          { type: 'header', content: 'The 50/30/20 Budget Rule' },
          {
            type: 'text',
            content:
              'A popular budgeting method allocates your after-tax income into three categories.',
          },
          {
            type: 'text',
            content:
              '50% for needs: rent, groceries, utilities, minimum debt payments, and other essential expenses.',
          },
          {
            type: 'text',
            content:
              '30% for wants: dining out, entertainment, hobbies, and other discretionary spending.',
          },
          {
            type: 'text',
            content:
              '20% for savings and debt repayment: emergency fund, retirement savings, and extra debt payments.',
          },
          { type: 'header', content: 'Tracking Income and Expenses' },
          {
            type: 'text',
            content:
              'Start by calculating your total monthly after-tax income from all sources.',
          },
          {
            type: 'text',
            content:
              'Then categorize all your expenses to see how much you currently spend in each area.',
          },
          {
            type: 'text',
            content:
              'This baseline helps you identify areas where you can adjust spending to meet your budget goals.',
          },
        );
      } else {
        // Generic content for other lessons
        content.push(
          { type: 'header', content: 'Key Concepts' },
          {
            type: 'text',
            content:
              'This lesson covers essential financial concepts that will help you make better money decisions.',
          },
          {
            type: 'text',
            content:
              'You will learn practical skills that you can apply immediately in your personal financial life.',
          },
          { type: 'header', content: 'Practical Applications' },
          {
            type: 'text',
            content:
              'Through hands-on activities using the Trinity Capital banking system, you will practice these concepts in a safe environment.',
          },
          {
            type: 'text',
            content:
              'These exercises will build your confidence and prepare you for real-world financial decision-making.',
          },
        );
      }
    }

    // Add lesson blocks if they exist
    if (lesson.lesson_blocks && Array.isArray(lesson.lesson_blocks)) {
      lesson.lesson_blocks.forEach(block => {
        if (block.type === 'instruction') {
          content.push({ type: 'header', content: 'Instructions' });
          content.push({ type: 'text', content: block.content });
        } else if (block.type === 'action') {
          content.push({ type: 'header', content: 'Action Required' });
          content.push({ type: 'text', content: block.content });
        } else {
          content.push({ type: 'text', content: block.content });
        }
      });
    }

    console.log(`📚 Converted to ${content.length} content blocks`);
    return content;
  }

  /**
   * Process content blocks according to architecture rules
   * @param {Array} content - Raw content array
   * @returns {Array} Processed content blocks
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
        // Other content types
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

    console.log(`📚 Processed into ${processedBlocks.length} content groups`);
    return processedBlocks;
  }

  /**
   * Create a visual content block element
   * @param {Object} block - The processed content block
   * @param {number} index - The block index
   * @returns {Element} The content block element
   */
  createContentBlock(block, index) {
    const blockContainer = document.createElement('div');
    blockContainer.className = `content-block ${block.type}`;
    blockContainer.style.cssText = `
      margin-bottom: 30px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.08);
      border-left: 5px solid ${this.getBlockColor(block.type)};
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    `;

    // Add hover effect
    blockContainer.addEventListener('mouseenter', () => {
      blockContainer.style.transform = 'translateY(-2px)';
      blockContainer.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
    });

    blockContainer.addEventListener('mouseleave', () => {
      blockContainer.style.transform = 'translateY(0)';
      blockContainer.style.boxShadow = '0 5px 20px rgba(0,0,0,0.08)';
    });

    // Render content based on block type
    switch (block.type) {
      case 'header_group':
        this.renderHeaderGroup(blockContainer, block.content);
        break;
      case 'text_group':
        this.renderTextGroup(blockContainer, block.content);
        break;
      case 'standalone_header':
        this.renderStandaloneHeader(blockContainer, block.content[0]);
        break;
      case 'standalone_content':
        this.renderStandaloneContent(blockContainer, block.content[0]);
        break;
    }

    return blockContainer;
  }

  /**
   * Get color for different block types
   * @param {string} type - Block type
   * @returns {string} Color value
   */
  getBlockColor(type) {
    const colors = {
      header_group: '#3498db',
      text_group: '#27ae60',
      standalone_header: '#e74c3c',
      standalone_content: '#f39c12',
    };
    return colors[type] || '#95a5a6';
  }

  /**
   * Render header group (header + associated text blocks)
   * @param {Element} container - Container element
   * @param {Array} content - Content items
   */
  renderHeaderGroup(container, content) {
    content.forEach(item => {
      if (item.type === 'header') {
        const header = document.createElement('h2');
        header.textContent = item.content;
        header.style.cssText = `
          color: #2c3e50;
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #3498db;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        container.appendChild(header);
      } else if (item.type === 'text') {
        const text = document.createElement('p');
        text.textContent = item.content;
        text.style.cssText = `
          color: #2c3e50;
          font-size: 1.1rem;
          line-height: 1.8;
          margin-bottom: 15px;
          text-align: justify;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        container.appendChild(text);
      }
    });
  }

  /**
   * Render text group (multiple text blocks without headers)
   * @param {Element} container - Container element
   * @param {Array} content - Content items
   */
  renderTextGroup(container, content) {
    content.forEach((item, index) => {
      const text = document.createElement('p');
      text.textContent = item.content;
      text.style.cssText = `
        color: #2c3e50;
        font-size: 1.1rem;
        line-height: 1.8;
        margin-bottom: 15px;
        text-align: justify;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        padding-left: ${index > 0 ? '20px' : '0'};
        border-left: ${index > 0 ? '3px solid #27ae60' : 'none'};
      `;
      container.appendChild(text);
    });
  }

  /**
   * Render standalone header (consecutive headers)
   * @param {Element} container - Container element
   * @param {Object} headerContent - Header content
   */
  renderStandaloneHeader(container, headerContent) {
    const header = document.createElement('h2');
    header.textContent = headerContent.content;
    header.style.cssText = `
      color: #2c3e50;
      font-size: 2rem;
      font-weight: 700;
      text-align: center;
      margin: 0;
      background: linear-gradient(135deg, #e74c3c, #c0392b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    container.appendChild(header);
  }

  /**
   * Render standalone content (other content types)
   * @param {Element} container - Container element
   * @param {Object} content - Content item
   */
  renderStandaloneContent(container, content) {
    const div = document.createElement('div');
    div.textContent = content.content || '';
    div.style.cssText = `
      color: #2c3e50;
      font-size: 1.1rem;
      line-height: 1.8;
      text-align: center;
      font-style: italic;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    container.appendChild(div);
  }

  /**
   * Render instructions section using lesson engine
   * @param {Element} container - Container element
   * @param {Object} lesson - Lesson object
   */
  renderInstructions(container, lesson) {
    const instructionsContainer = document.createElement('div');
    instructionsContainer.className = 'lesson-instructions-section';
    instructionsContainer.style.cssText = `
      margin-top: 40px;
      padding: 30px;
      background: linear-gradient(135deg, #3498db, #2980b9);
      border-radius: 15px;
      color: white;
    `;

    const instructionsTitle = document.createElement('h3');
    instructionsTitle.textContent = 'Your Tasks';
    instructionsTitle.style.cssText = `
      color: white;
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 20px;
      text-align: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    const instructionsList = document.createElement('div');
    instructionsList.className = 'instructions-list';
    instructionsList.style.cssText =
      'display: flex; flex-direction: column; gap: 15px;';

    // Generate specific instructions using lesson engine
    console.log('🎯 Generating lesson instructions via lesson engine...');
    const specificInstructions = this.generateLessonEngineInstructions(lesson);

    specificInstructions.forEach((instruction, index) => {
      const instructionItem = document.createElement('div');
      instructionItem.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        padding: 20px;
        border-radius: 10px;
        border-left: 4px solid rgba(255, 255, 255, 0.8);
        margin-bottom: 10px;
      `;

      // Create instruction with proper formatting
      const instructionContent = document.createElement('div');
      instructionContent.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 15px;">
          <div style="font-size: 1.5rem; line-height: 1;">${instruction.icon}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 8px;">${instruction.title}</div>
            <div style="font-size: 0.95rem; line-height: 1.4; opacity: 0.9;">${instruction.description}</div>
            ${instruction.location ? `<div style="font-size: 0.85rem; margin-top: 8px; padding: 6px 12px; background: rgba(255,255,255,0.15); border-radius: 15px; display: inline-block;"><strong>Location:</strong> ${instruction.location}</div>` : ''}
          </div>
        </div>
      `;

      instructionItem.appendChild(instructionContent);
      instructionsList.appendChild(instructionItem);
    });

    // Add begin button
    const beginButton = document.createElement('button');
    beginButton.textContent = 'Begin Activities';
    beginButton.style.cssText = `
      background: linear-gradient(135deg, #27ae60, #229954);
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 25px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      transition: all 0.3s ease;
      box-shadow: 0 5px 15px rgba(39, 174, 96, 0.4);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: block;
      margin-left: auto;
      margin-right: auto;
    `;

    beginButton.addEventListener('mouseenter', () => {
      beginButton.style.transform = 'translateY(-2px)';
      beginButton.style.boxShadow = '0 8px 25px rgba(39, 174, 96, 0.6)';
    });

    beginButton.addEventListener('mouseleave', () => {
      beginButton.style.transform = 'translateY(0)';
      beginButton.style.boxShadow = '0 5px 15px rgba(39, 174, 96, 0.4)';
    });

    beginButton.addEventListener('click', async () => {
      await this.activateLessonTracking(lesson);
      // Close the modal instead of returning to lessons list
      const modalOverlay = container.closest('.lesson-modal-overlay');
      if (modalOverlay) {
        this.closeModal(modalOverlay);
      }
    });

    instructionsContainer.appendChild(instructionsTitle);
    instructionsContainer.appendChild(instructionsList);
    instructionsContainer.appendChild(beginButton);
    container.appendChild(instructionsContainer);
  }

  /**
   * Generate specific, actionable instructions using lesson engine logic
   * @param {Object} lesson - The lesson object with lesson_conditions
   * @returns {Array} Array of detailed instruction objects
   */
  generateLessonEngineInstructions(lesson) {
    const instructions = [];

    if (!lesson.lesson_conditions || !Array.isArray(lesson.lesson_conditions)) {
      console.warn('⚠️ No lesson conditions found for instruction generation');
      return [
        {
          icon: '📚',
          title: 'Complete the lesson activities',
          description: 'Follow the guidance provided to complete this lesson.',
          location: 'Use the Trinity Capital app features',
        },
      ];
    }

    // Process each lesson condition and generate specific instructions
    lesson.lesson_conditions.forEach((condition, index) => {
      const instruction = this.interpretConditionToInstruction(
        condition,
        lesson,
      );
      if (instruction) {
        instructions.push(instruction);
      }
    });

    // If no specific instructions were generated, provide fallback
    if (instructions.length === 0) {
      instructions.push({
        icon: '🎯',
        title: 'Complete lesson objectives',
        description:
          'Use the Trinity Capital banking app to practice the concepts covered in this lesson.',
        location: 'Navigate through the app sections as needed',
      });
    }

    return instructions;
  }

  /**
   * Interpret a lesson condition and generate specific app-based instruction
   * @param {Object} condition - Individual lesson condition
   * @param {Object} lesson - Full lesson object for context
   * @returns {Object} Detailed instruction object
   */
  interpretConditionToInstruction(condition, lesson) {
    console.log('🔍 Processing condition:', condition.condition_type);

    // Get template from imported templates file - no more duplicate inline templates!
    const template = getInstructionTemplate(condition.condition_type);

    if (template) {
      // Add any additional context from action_details
      let enhancedDescription = template.description;
      if (condition.action_details?.message) {
        enhancedDescription += ` ${condition.action_details.message}`;
      }

      return {
        ...template,
        description: enhancedDescription,
        priority: condition.action_details?.priority || 'medium',
        autoTrigger: condition.action_details?.auto_trigger || false,
      };
    }

    // Return null if no template found
    return null;
  }

  /**
   * Activate lesson tracking and initialize lesson engine
   * @param {Object} lesson - The lesson object
   */
  async activateLessonTracking(lesson) {
    console.log('🚀 Activating lesson tracking for:', lesson.lesson_title);

    // Initialize lesson engine if available
    if (window.lessonEngine) {
      // Set the current lesson for tracking
      window.lessonEngine.currentLesson = lesson;
      console.log('✅ Lesson set for tracking:', lesson.lesson_id);

      // Initialize the engine for this student if not already done
      if (!window.lessonEngine.initialized) {
        await window.lessonEngine.initialize(this.currentStudent);
        console.log('🔍 Lesson engine initialized for student');
      }
    } else {
      console.warn('⚠️ Lesson engine not available for tracking');
    }

    // Store lesson progress
    this.markLessonAsStarted(lesson);
  }

  /**
   * Mark lesson as started in localStorage
   * @param {Object} lesson - The lesson object
   */
  markLessonAsStarted(lesson) {
    const progressKey = `lesson_progress_${this.currentStudent}`;
    let progress = {};

    try {
      const stored = localStorage.getItem(progressKey);
      if (stored) {
        progress = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ Error reading lesson progress:', error);
    }

    progress[lesson.lesson_id] = {
      status: 'started',
      startedAt: new Date().toISOString(),
      title: lesson.lesson_title,
    };

    try {
      localStorage.setItem(progressKey, JSON.stringify(progress));
      console.log('📝 Lesson progress saved');
    } catch (error) {
      console.warn('⚠️ Error saving lesson progress:', error);
    }
  }

  /**
   * Display message when no lessons are available
   */
  displayNoLessonsMessage() {
    if (this.contentContainer) {
      this.contentContainer.innerHTML = `
        <div style="
          text-align: center;
          padding: 60px 20px;
          color: #7f8c8d;
          background: linear-gradient(135deg, #f8f9fa, #e9ecef);
          border-radius: 15px;
          margin: 20px 0;
        ">
          <h3>📚 No Lessons Available</h3>
          <p>There are currently no lessons assigned to this student.</p>
          <p>Check back later or contact your instructor for more information.</p>
        </div>
      `;
    }
  }

  /**
   * Display error message when lesson loading fails
   */
  displayLessonsError() {
    if (this.contentContainer) {
      this.contentContainer.innerHTML = `
        <div style="
          text-align: center;
          padding: 60px 20px;
          background: linear-gradient(135deg, #f8d7da, #f5c6cb);
          border: 1px solid #f5c6cb;
          border-radius: 15px;
          margin: 20px 0;
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

  /**
   * Enhanced lesson condition analysis with comprehensive tracking
   */
  analyzeComprehensiveConditions(lessonData) {
    if (!lessonData || !lessonData.conditions) {
      return [];
    }

    return lessonData.conditions.map(condition => {
      const template = this.getInstructionForCondition(condition);
      return {
        ...condition,
        instruction: template,
        timestamp: new Date().toISOString(),
      };
    });
  }
}

// Initialize global lesson renderer instance
window.lessonRenderer = new LessonRenderer();

/**
 * Legacy renderLessons function for compatibility with existing script.js
 * This maintains compatibility with the existing system
 * @param {Object} studentProfile - The student's profile object
 */
export async function renderLessons(studentProfile) {
  console.log('🔥 renderLessons called with profile:', studentProfile);
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

      console.log(
        '📚 Circular lesson buttons displayed. User can now select a lesson to start.',
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

console.log('✅ Trinity Capital Lesson Renderer loaded and ready');

// Export the class for module imports
export { LessonRenderer };
export default LessonRenderer;

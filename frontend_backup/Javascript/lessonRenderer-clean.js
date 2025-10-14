'use strict';

/**
 * Trinity Capital - Lesson Renderer
 *
 * Handles displaying lessons in the original circular button format
 * with unit headers and proper lesson progression
 */

/**
 * LessonRenderer class for displaying lessons in the Trinity Capital banking application
 */
class LessonRenderer {
  constructor() {
    this.currentStudent = null;
    this.contentContainer = null;
    this.currentLesson = null;
  }

  /**
   * Initialize the lesson renderer for a specific student and container
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
        this.contentContainer.className = 'lesson-content-container';
        targetContainer.appendChild(this.contentContainer);
        console.log(
          `📚 Created new lesson-content container in ${targetContainer.tagName}`,
        );
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
    console.log('🔥 contentContainer:', this.contentContainer);

    if (!this.contentContainer) {
      console.warn('⚠️ No content container found for displaying lessons');
      return;
    }

    console.log(`📚 Displaying ${lessons.length} lessons in the lessons block`);

    // Find the lesson header and update it with unit information
    const lessonHeader =
      this.contentContainer.querySelector('.lessonHeaderText');
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

    // Render the lesson content in a modal or separate area (not in the lessons block)
    this.renderLessonContent(lesson);
  }

  /**
   * Render lesson content in a modal or separate area
   * @param {Object} lesson - The lesson object
   */
  renderLessonContent(lesson) {
    // For now, just show an alert - this would normally open a lesson modal
    alert(
      `Starting lesson: ${lesson.lesson_title}\n\nThis would normally open the lesson content in a modal or separate area.`,
    );
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LessonRenderer, renderLessons };
}

console.log('✅ Trinity Capital Lesson Renderer loaded successfully');

'use strict';

// Import instruction templates for generating student instructions
import { instructionTemplates } from './instructionTemplates.js';

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
    this.currentStudentProfile = null;
  }

  /**
   * Fetch available lessons for the current student using assignedUnitIds.lessonIds
   * @returns {Promise<Array>} Promise resolving to an array of lesson objects
   */
  async getAvailableLessons() {
    console.log('🔄 Getting available lessons...');
    try {
      // Get the current student name
      const studentName = this.currentStudent;
      if (!studentName) {
        console.error('❌ No current student set in lessonRenderer');
        return [];
      }

      console.log(`🔍 Fetching profile for student: ${studentName}`);

      // Fetch the student profile directly from the server
      try {
        const profileResponse = await fetch(
          `http://localhost:3000/profiles/${encodeURIComponent(studentName)}`,
        );

        if (!profileResponse.ok) {
          console.error(
            `❌ Failed to fetch student profile: ${profileResponse.status} ${profileResponse.statusText}`,
          );

          // Fallback to global profile if available
          const fallbackProfile =
            window.currentStudentProfile ||
            (window.lessonRenderer &&
              window.lessonRenderer.currentStudentProfile);

          if (fallbackProfile) {
            console.log('⚠️ Using fallback profile from global state');

            // Store the profile for future use
            this.currentStudentProfile = fallbackProfile;

            // Continue with fallback profile
            return this.processProfileForLessons(fallbackProfile);
          }

          return [];
        }

        // Parse the profile from the response
        const profile = await profileResponse.json();
        console.log('✅ Successfully fetched student profile');

        // Store the profile for future use
        this.currentStudentProfile = profile;

        // Process the profile to get lessons
        return this.processProfileForLessons(profile);
      } catch (fetchError) {
        console.error('❌ Error fetching student profile:', fetchError);

        // Fallback to global profile
        const fallbackProfile =
          window.currentStudentProfile ||
          (window.lessonRenderer &&
            window.lessonRenderer.currentStudentProfile);

        if (fallbackProfile) {
          console.log('⚠️ Using fallback profile due to fetch error');

          // Store the profile for future use
          this.currentStudentProfile = fallbackProfile;

          // Continue with fallback profile
          return this.processProfileForLessons(fallbackProfile);
        }

        return [];
      }
    } catch (error) {
      console.error('❌ Error in getAvailableLessons:', error);
      return [];
    }
  }

  /**
   * Process a student profile to extract and fetch lessons
   * @param {Object} profile - The student profile object
   * @returns {Promise<Array>} Promise resolving to an array of lesson objects
   * @private
   */
  async processProfileForLessons(profile) {
    console.log('👤 Processing profile for lessons:', profile.memberName);

    // Get lesson IDs from the profile
    let lessonIds = [];

    if (
      profile.assignedUnitIds &&
      Array.isArray(profile.assignedUnitIds.lessonIds)
    ) {
      // Direct assignedUnitIds.lessonIds structure
      lessonIds = profile.assignedUnitIds.lessonIds;
    } else if (
      profile.assignedUnitIds &&
      Array.isArray(profile.assignedUnitIds)
    ) {
      // Array of unit objects with lessonIds
      profile.assignedUnitIds.forEach(unit => {
        if (unit.lessonIds && Array.isArray(unit.lessonIds)) {
          lessonIds = lessonIds.concat(unit.lessonIds);
        }
      });
    }

    // Fallback to sample lessons if no lessons found
    if (lessonIds.length === 0) {
      console.warn('⚠️ No lesson IDs found in profile, using sample lessons');

      // Use default sample lesson IDs
      lessonIds = [
        '1754331337919',
        '1754331337920',
        '1754331337921',
        '1754331337922',
      ];
    }

    // Log student profile and lesson IDs for debugging
    console.log('👤 Student profile:', profile);
    console.log('🧩 Lesson IDs to fetch:', lessonIds);

    // SUPER LOUD DEBUG BEFORE FETCH
    console.log(
      '%c 🚀 ATTEMPTING FETCH TO LESSON SERVER NOW 🚀 ',
      'background: #ff0000; color: white; font-size: 20px;',
    );
    console.log(
      '%c POST to http://localhost:4000/get-lessons-by-ids ',
      'background: #ff0000; color: white; font-size: 16px;',
    );
    console.log(
      '%c With lessonIds: ',
      'background: #ff0000; color: white; font-size: 14px;',
      lessonIds,
    );
    console.log(
      '%c Current Origin: ',
      'background: #ff0000; color: white; font-size: 14px;',
      window.location.origin,
    );

    try {
      // Define the URL with correct origin (local lesson server)
      const lessonServerUrl = 'http://localhost:4000/get-lessons-by-ids';

      console.log(
        '%c Fetch URL: ',
        'background: #ff0000; color: white; font-size: 14px;',
        lessonServerUrl,
      );

      // Try first attempt with credentials: 'omit' (no credentials)
      console.log(
        '%c Trying fetch WITHOUT credentials',
        'color: orange; font-size: 14px;',
      );

      // POST lessonIds and student profile to backend to fetch lessons
      const response = await fetch(lessonServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonIds,
          studentName: profile.memberName || 'Unknown Student',
        }),
        credentials: 'omit',
        mode: 'cors',
      });

      console.log(
        '%c ✅ FETCH RESPONSE RECEIVED ',
        'background: green; color: white; font-size: 16px;',
      );
      console.log('Response status:', response.status);

      if (!response.ok)
        throw new Error(
          `Failed to fetch lessons by IDs. Status: ${response.status}`,
        );

      const data = await response.json();
      console.log('📚 Full response data:', data);

      // Properly extract lessons based on response structure
      let lessons = [];
      if (Array.isArray(data)) {
        lessons = data;
      } else if (data && data.success && Array.isArray(data.lessons)) {
        lessons = data.lessons;
      } else if (data && Array.isArray(data.lessons)) {
        lessons = data.lessons;
      }

      console.log(`📘 Successfully extracted ${lessons.length} lessons`);
      return lessons;
    } catch (fetchError) {
      console.error(
        '%c ❌ FETCH ERROR: ',
        'background: red; color: white; font-size: 16px;',
        fetchError,
      );
      return [];
    }
  }

  /**
   * Initialize the lesson renderer for a student and container
   * @param {string} studentName - The student's name or ID
   * @param {string} containerSelector - The selector or ID of the container
   * @returns {boolean} True if initialized
   */
  initialize(studentName, containerSelector) {
    this.currentStudent = studentName;
    // Support both selector string and element
    if (typeof containerSelector === 'string') {
      this.contentContainer =
        document.getElementById(containerSelector) ||
        document.querySelector('.' + containerSelector) ||
        document.querySelector(containerSelector);
    } else {
      this.contentContainer = containerSelector;
    }
    return !!this.contentContainer;
  }

  /**
   * Create a modern circular lesson button
   * @param {Object} lesson - The lesson object
   * @param {number} index - The lesson index
   */
  createCircularLessonButton(lesson, index) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'lesson-button-container';
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 0 0 auto;
      width: 100px;
      cursor: pointer;
      transition: transform 0.3s ease;
    `;

    // Determine lesson availability
    const isLessonAvailable = this.checkLessonAvailability(lesson, index);

    // Create circular button with modern styling
    const circularButton = document.createElement('div');
    circularButton.className = 'lesson-circle-button';

    // Set appropriate styles based on lesson status
    let buttonStyles = `
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      margin-bottom: 10px;
      border: 3px solid rgba(255,255,255,0.1);
    `;

    if (lesson.isCompleted) {
      // Completed lesson - gradient green
      buttonStyles += `
        background: linear-gradient(135deg, #27ae60, #2ecc71);
        box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
      `;
    } else if (isLessonAvailable) {
      // Available lesson - gradient blue
      buttonStyles += `
        background: linear-gradient(135deg, #2980b9, #3498db);
        box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
      `;
    } else {
      // Locked lesson - gradient gray
      buttonStyles += `
        background: linear-gradient(135deg, #95a5a6, #bdc3c7);
        box-shadow: 0 4px 15px rgba(149, 165, 166, 0.3);
        cursor: not-allowed;
        opacity: 0.7;
      `;
    }

    circularButton.style.cssText = buttonStyles;

    // Add lesson icon
    const lessonNumber = index + 1;
    const icons = ['📚', '💰', '🏦', '📊', '💳', '🎯', '📈', '🎓', '💡', '🔍'];
    const icon = icons[index % icons.length];

    circularButton.innerHTML = `
      <span style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${icon}</span>
    `;

    // Add lesson title below the circle
    const lessonTitle = document.createElement('p');
    lessonTitle.className = 'lesson-title-text';
    lessonTitle.style.cssText = `
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      margin: 0;
      max-width: 90px;
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
        width: 22px;
        height: 22px;
        background: linear-gradient(135deg, #f39c12, #e67e22);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
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
   * Render all content blocks as slides, including text slides
   * @param {Element} container - The container element
   * @param {Array} content - The content array
   */
  renderLessonContent(container, content) {
    // Remove old content
    container.innerHTML = '';

    console.log('🔍 Rendering lesson content with schema:', content);

    // Create carousel wrapper
    const carouselId = 'lessonCarousel_' + Math.floor(Math.random() * 1000000);
    const carousel = document.createElement('div');
    carousel.id = carouselId;
    carousel.className = 'carousel slide';
    carousel.setAttribute('data-bs-ride', 'false'); // Disable auto sliding
    carousel.setAttribute('data-bs-wrap', 'false'); // Disable wrapping
    carousel.style.cssText = `
      position: relative;
      width: 100%;
      overflow: hidden;
    `;

    // Carousel inner
    const carouselInner = document.createElement('div');
    carouselInner.className = 'carousel-inner';
    carouselInner.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;

    // Define processedBlocks outside the conditional to make it accessible in the entire method
    let processedBlocks = [];

    // Check if content is in the proper format
    if (!Array.isArray(content)) {
      console.error('❌ Content is not an array:', content);
      const errorSlide = document.createElement('div');
      errorSlide.className = 'carousel-item active';
      errorSlide.innerHTML =
        '<div class="content-block error"><h3>Error: Invalid content format</h3><p>Using sample content instead.</p></div>';
      carouselInner.appendChild(errorSlide);

      // Create sample content if the format is invalid
      const sampleContent = this.generateSampleContent(this.currentLesson);
      processedBlocks = this.processContentBlocks(sampleContent);
      console.log(
        '📚 Using sample content due to invalid format:',
        processedBlocks,
      );

      // Render the sample content slides
      processedBlocks.forEach((block, idx) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-item';
        // Make the first sample content slide active (index 1 because we already have the error slide as active)
        if (idx === 0) {
          slide.classList.add('active');
          // Remove active class from error slide since we now have real content
          const errorSlide = carouselInner.querySelector(
            '.carousel-item.active',
          );
          if (errorSlide) {
            errorSlide.classList.remove('active');
          }
        }

        const contentBlock = this.createContentBlock(block, idx);
        slide.appendChild(contentBlock);
        carouselInner.appendChild(slide);
      });
    } else {
      // Render all content blocks as slides
      processedBlocks = this.processContentBlocks(content);
      console.log('📚 Processed blocks for rendering:', processedBlocks);

      processedBlocks.forEach((block, idx) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-item';
        slide.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          transition: transform .6s ease-in-out;
          opacity: 0;
          visibility: hidden;
        `;

        if (idx === 0) {
          slide.classList.add('active');
          slide.style.opacity = '1';
          slide.style.visibility = 'visible';
        }

        const contentBlock = this.createContentBlock(block, idx);
        slide.appendChild(contentBlock);
        carouselInner.appendChild(slide);
      });
    }

    // Add instructions as the final slide (but never active by default)
    const instructionsSlide = document.createElement('div');
    instructionsSlide.className = 'carousel-item'; // Ensure no active class here
    instructionsSlide.setAttribute('data-slide-type', 'instructions'); // Mark as instructions slide
    instructionsSlide.style.cssText = `
      min-height: 580px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      opacity: 0;
      visibility: hidden;
      transition: transform .6s ease-in-out;
    `;
    const instructionsList = document.createElement('div');
    instructionsList.className = 'instructions-list';
    instructionsList.style.cssText = `
      display: flex; 
      flex-direction: column; 
      gap: 15px; 
      max-width: 700px; 
      width: 100%;
      margin: 0 auto; 
      padding: 30px; 
      background: #1a2035;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 15px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      color: #ffffff;
      height: auto;
      max-height: 520px;
      overflow-y: auto;
    `;

    // Add a heading for the instructions slide
    const instructionsHeading = document.createElement('h2');
    instructionsHeading.textContent = 'Lesson Activities';
    instructionsHeading.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #ffffff;
      font-weight: 600;
      font-size: 1.8rem;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    instructionsList.appendChild(instructionsHeading);

    const lesson = this.currentLesson || {};
    const instructions = this.generateLessonEngineInstructions(lesson);
    if (instructions.length > 0) {
      instructions.forEach(instruction => {
        const instructionItem = document.createElement('div');
        instructionItem.className = 'instruction-item';

        // Set border color based on priority
        let borderColor = '#3498db'; // Default blue for medium priority
        if (instruction.priority === 'high') {
          borderColor = '#e74c3c'; // Red for high priority
        } else if (instruction.priority === 'low') {
          borderColor = '#2ecc71'; // Green for low priority
        }

        instructionItem.style.cssText = `
          padding: 15px;
          background: #1a2035;
          border-left: 4px solid ${borderColor};
          border-radius: 6px;
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;

        // Create the header section with icon and title
        const instructionHeader = document.createElement('div');
        instructionHeader.style.cssText = `
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        `;

        // Add the icon from the instruction template
        const instructionIcon = document.createElement('span');
        instructionIcon.innerHTML =
          instruction.icon ||
          '<i class="fas fa-clipboard-check" aria-hidden="true"></i>';
        instructionIcon.style.cssText = `
          font-size: 20px;
          margin-right: 12px;
          color: ${borderColor};
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        // Add the title
        const instructionTitle = document.createElement('h3');
        instructionTitle.textContent = instruction.title || 'Complete Action';
        instructionTitle.style.cssText = `
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: ${borderColor};
        `;

        // Add icon and title to header
        instructionHeader.appendChild(instructionIcon);
        instructionHeader.appendChild(instructionTitle);

        // Add the description
        const instructionDescription = document.createElement('p');
        instructionDescription.textContent =
          instruction.description ||
          'Follow the instructions to complete this task.';
        instructionDescription.style.cssText = `
          margin: 0 0 8px 0;
          color: #ffffff;
          font-weight: 400;
        `;

        // Add the location guidance if available
        const instructionLocation = document.createElement('p');
        instructionLocation.textContent =
          instruction.location || 'Use the appropriate section in the app';
        instructionLocation.style.cssText = `
          margin: 0;
          font-size: 14px;
          font-style: italic;
          color: rgba(255,255,255,0.7);
        `;

        // Assemble all parts
        instructionItem.appendChild(instructionHeader);
        instructionItem.appendChild(instructionDescription);
        instructionItem.appendChild(instructionLocation);

        instructionsList.appendChild(instructionItem);
      });
    } else {
      const noInstructions = document.createElement('p');
      noInstructions.textContent = 'No instructions available for this lesson.';
      noInstructions.style.cssText = `
        text-align: center;
        font-style: italic;
        color: rgba(255,255,255,0.7);
        margin-top: 20px;
      `;
      instructionsList.appendChild(noInstructions);
    }

    instructionsSlide.appendChild(instructionsList);
    carouselInner.appendChild(instructionsSlide);

    carousel.appendChild(carouselInner);

    // Add carousel indicators
    const indicatorsCount =
      carouselInner.querySelectorAll('.carousel-item').length;
    if (indicatorsCount > 1) {
      console.log(`🎠 Creating indicators for ${indicatorsCount} slides`);
      const indicators = document.createElement('div');
      indicators.className = 'carousel-indicators';
      indicators.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        padding: 0;
        margin-right: 15%;
        margin-bottom: 1rem;
        margin-left: 15%;
        list-style: none;
        z-index: 10;
      `;

      for (let i = 0; i < indicatorsCount; i++) {
        const indicator = document.createElement('button');
        indicator.type = 'button';
        indicator.setAttribute('data-bs-target', `#${carouselId}`);
        indicator.setAttribute('data-bs-slide-to', i.toString());
        indicator.setAttribute('aria-label', `Slide ${i + 1}`);
        indicator.style.cssText = `
          box-sizing: content-box;
          flex: 0 1 auto;
          width: 30px;
          height: 5px;
          margin-right: 5px;
          margin-left: 5px;
          cursor: pointer;
          background-color: rgba(255,255,255,0.5);
          background-clip: padding-box;
          border: 0;
          border-radius: 3px;
          opacity: .5;
          transition: opacity .6s ease, background-color .3s ease;
        `;

        if (i === 0) {
          indicator.classList.add('active');
          indicator.setAttribute('aria-current', 'true');
          indicator.style.opacity = '1';
          indicator.style.backgroundColor = 'rgba(255,255,255,0.9)';
          indicator.style.width = '40px';
        }

        // Add hover effect
        indicator.addEventListener('mouseover', function () {
          if (!this.classList.contains('active')) {
            this.style.opacity = '0.8';
          }
        });

        indicator.addEventListener('mouseout', function () {
          if (!this.classList.contains('active')) {
            this.style.opacity = '0.5';
          }
        });

        indicators.appendChild(indicator);
      }

      carousel.appendChild(indicators);
    }

    // Carousel controls - using processedBlocks length to determine if controls are needed
    if (processedBlocks && processedBlocks.length > 0) {
      const prevControl = document.createElement('button');
      prevControl.className = 'carousel-control-prev';
      prevControl.setAttribute('type', 'button');
      prevControl.setAttribute('data-bs-target', `#${carouselId}`);
      prevControl.setAttribute('data-bs-slide', 'prev');
      prevControl.innerHTML = `
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      `;
      prevControl.style.cssText = `
        width: 5%;
        opacity: 0.7;
        transition: opacity 0.3s ease;
      `;

      const nextControl = document.createElement('button');
      nextControl.className = 'carousel-control-next';
      nextControl.setAttribute('type', 'button');
      nextControl.setAttribute('data-bs-target', `#${carouselId}`);
      nextControl.setAttribute('data-bs-slide', 'next');
      nextControl.innerHTML = `
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      `;
      nextControl.style.cssText = `
        width: 5%;
        opacity: 0.7;
        transition: opacity 0.3s ease;
      `;

      // Add hover effects
      prevControl.addEventListener(
        'mouseover',
        () => (prevControl.style.opacity = '1'),
      );
      prevControl.addEventListener(
        'mouseout',
        () => (prevControl.style.opacity = '0.7'),
      );
      nextControl.addEventListener(
        'mouseover',
        () => (nextControl.style.opacity = '1'),
      );
      nextControl.addEventListener(
        'mouseout',
        () => (nextControl.style.opacity = '0.7'),
      );

      carousel.appendChild(prevControl);
      carousel.appendChild(nextControl);
    }

    container.appendChild(carousel);

    // Add custom CSS to override any problematic global styles
    const styleId = 'carousel-fix-style-' + carouselId;
    if (!document.getElementById(styleId)) {
      const carouselFixStyle = document.createElement('style');
      carouselFixStyle.id = styleId;
      carouselFixStyle.textContent = `
        #${carouselId} .carousel-item {
          display: block;
          width: 100%;
          margin-left: 0;
          position: absolute;
          transition: opacity 0.5s ease-in-out;
        }
        #${carouselId} .carousel-item.active {
          opacity: 1 !important;
          visibility: visible !important;
          position: relative !important;
        }
        #${carouselId} .carousel-inner {
          height: 580px;
          position: relative;
        }
      `;
      document.head.appendChild(carouselFixStyle);
      console.log('🎠 Added custom carousel fix styles');
    }

    // Initialize the Bootstrap carousel with improved controls
    try {
      console.log('🎠 Initializing carousel...');

      // First, verify only one slide has the active class
      const activeSlides = carousel.querySelectorAll('.carousel-item.active');
      if (activeSlides.length > 1) {
        console.warn('⚠️ Multiple active slides detected, fixing...');
        activeSlides.forEach((slide, idx) => {
          if (idx > 0) slide.classList.remove('active');
        });
      } else if (activeSlides.length === 0) {
        console.warn('⚠️ No active slides detected, fixing...');
        const firstSlide = carousel.querySelector('.carousel-item');
        if (firstSlide) firstSlide.classList.add('active');
      }

      setTimeout(() => {
        try {
          console.log(
            '🎠 Creating carousel instance with preventative settings...',
          );
          const carouselInstance = new bootstrap.Carousel(carousel, {
            interval: false, // Explicitly prevent auto-advance
            wrap: false, // Prevent wrapping around to the first/last slide
            keyboard: true, // Allow keyboard navigation
            pause: true, // Always paused - never auto-cycle
            ride: false, // Ensure it doesn't auto-start cycling
            touch: true, // Enable touch/swipe navigation
          });

          console.log('🎠 Forcing carousel to slide 0');
          // Force the carousel to start at the first slide
          setTimeout(() => {
            carouselInstance.to(0);
            console.log('🎠 Carousel explicitly set to first slide');
          }, 100);

          // Add event listeners to control buttons for better control
          const prevButton = carousel.querySelector('.carousel-control-prev');
          const nextButton = carousel.querySelector('.carousel-control-next');
          if (prevButton && nextButton) {
            console.log('🎠 Adding custom navigation button listeners');
            prevButton.addEventListener('click', e => {
              e.preventDefault();
              carouselInstance.prev();
            });
            nextButton.addEventListener('click', e => {
              e.preventDefault();
              carouselInstance.next();
            });
          }

          // Add event listener for slide change to update active indicator and handle visibility
          carousel.addEventListener('slide.bs.carousel', function (event) {
            console.log(`🎠 Sliding to index: ${event.to}`);

            // Update all slides visibility
            const allSlides = this.querySelectorAll('.carousel-item');
            allSlides.forEach((slide, idx) => {
              // Hide all slides except the target one
              if (idx === event.to) {
                slide.style.opacity = '1';
                slide.style.visibility = 'visible';
              } else {
                slide.style.opacity = '0';
                slide.style.visibility = 'hidden';
              }
            });

            // Update indicators
            const indicators = this.querySelectorAll(
              '.carousel-indicators button',
            );
            indicators.forEach((ind, index) => {
              if (index === event.to) {
                ind.style.opacity = '1';
                ind.style.backgroundColor = 'rgba(255,255,255,0.9)';
                ind.style.width = '40px';
              } else {
                ind.style.opacity = '0.5';
                ind.style.backgroundColor = 'rgba(255,255,255,0.5)';
                ind.style.width = '30px';
              }
            });
          });

          console.log(
            '✅ Lesson slides and instructions rendered successfully.',
          );
        } catch (innerError) {
          console.error('❌ Error initializing carousel (inner):', innerError);
          // Fallback initialization if the standard method fails
          try {
            console.log(
              '🎠 Attempting fallback jQuery carousel initialization',
            );
            $(carousel).carousel({
              interval: false,
              wrap: false,
              keyboard: true,
              pause: true,
            });

            // Force the carousel to the first slide using jQuery
            $(carousel).carousel(0);
            console.log('✅ Fallback carousel initialization successful');

            // Add custom event handlers for jQuery version too
            $(carousel).on('slide.bs.carousel', function (event) {
              console.log(`🎠 jQuery carousel sliding to index: ${event.to}`);
            });
          } catch (jqueryError) {
            console.error(
              '❌ All carousel initialization methods failed:',
              jqueryError,
            );
          }
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error initializing carousel:', error);
    }

    // Mark this lesson as the current lesson for instruction generation
    if (lesson) {
      this.currentLesson = lesson;
    }
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
    return true;
  }

  /**
   * Start a specific lesson - create modal that takes up the lessonsBlock
   * @param {Object} lesson - The lesson object to start
   */
  startLesson(lesson) {
    console.log(`🚀 Starting lesson modal for: ${lesson.lesson_title}`);
    this.currentLesson = lesson;
    const oldModal = document.querySelector('.lesson-modal-overlay');
    if (oldModal) oldModal.remove();
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
      transition: opacity 0.3s ease;
    `;
    const modalDialog = document.createElement('div');
    modalDialog.className = 'lesson-modal-dialog';
    modalDialog.style.cssText = `
      width: 90%;
      max-width: 900px;
      height: 650px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.3);
      overflow-y: auto;
      position: relative;
      animation: modalSlideIn 0.4s ease-out;
      padding-bottom: 80px;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;

    // Add close button in the top-right corner
    const closeButton = document.createElement('button');
    closeButton.className = 'lesson-modal-close-btn';
    closeButton.innerHTML = '&times;'; // × symbol
    closeButton.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      width: 40px;
      height: 40px;
      background: #e74c3c;
      border: none;
      border-radius: 50%;
      font-size: 24px;
      font-weight: bold;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
      padding: 0;
      line-height: 1;
    `;

    // Add hover effect
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#c0392b';
      closeButton.style.transform = 'scale(1.05)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#e74c3c';
      closeButton.style.transform = 'scale(1)';
    });

    // Add click handler to close the modal
    closeButton.addEventListener('click', () => {
      this.closeModal(modalOverlay);
    });

    modalDialog.appendChild(closeButton);
    const contentContainer = document.createElement('div');
    contentContainer.className = 'lesson-modal-content';
    contentContainer.style.cssText = `
      padding: 32px 32px 0 32px;
      min-height: 400px;
    `;

    // Debug output to see the lesson structure
    console.log('🔍 Lesson content check:', {
      hasLesson: !!lesson,
      content: lesson?.content,
      isArray: Array.isArray(lesson?.content),
      length: lesson?.content?.length || 0,
    });

    // Set this lesson as the current lesson for content generation
    this.currentLesson = lesson || {};

    if (
      !lesson ||
      !Array.isArray(lesson.content) ||
      lesson.content.length === 0
    ) {
      console.log('⚠️ No lesson content found, generating sample content');
      // Generate sample content rather than showing error message
      const sampleContent = this.generateSampleContent(lesson);
      this.renderLessonContent(contentContainer, sampleContent);
    } else {
      console.log(
        '✅ Rendering lesson content:',
        lesson.content.length,
        'items',
      );
      this.renderLessonContent(contentContainer, lesson.content);

      // After rendering content, find the carousel and add controls
      setTimeout(() => {
        const carousel = contentContainer.querySelector('.carousel');
        if (carousel) {
          // Add prev/next controls if they don't exist
          if (!carousel.querySelector('.carousel-control-prev')) {
            // Previous button
            const prevButton = document.createElement('button');
            prevButton.className = 'carousel-control-prev';
            prevButton.type = 'button';
            prevButton.setAttribute('data-bs-target', `#${carousel.id}`);
            prevButton.setAttribute('data-bs-slide', 'prev');
            prevButton.innerHTML = `
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            `;
            carousel.appendChild(prevButton);

            // Next button
            const nextButton = document.createElement('button');
            nextButton.className = 'carousel-control-next';
            nextButton.type = 'button';
            nextButton.setAttribute('data-bs-target', `#${carousel.id}`);
            nextButton.setAttribute('data-bs-slide', 'next');
            nextButton.innerHTML = `
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            `;
            carousel.appendChild(nextButton);

            // Add slide indicators
            const carouselInner = carousel.querySelector('.carousel-inner');
            const slideCount =
              carouselInner.querySelectorAll('.carousel-item').length;

            if (slideCount > 1) {
              const indicators = document.createElement('div');
              indicators.className = 'carousel-indicators';

              for (let i = 0; i < slideCount; i++) {
                const indicator = document.createElement('button');
                indicator.type = 'button';
                indicator.setAttribute('data-bs-target', `#${carousel.id}`);
                indicator.setAttribute('data-bs-slide-to', i.toString());
                if (i === 0) {
                  indicator.classList.add('active');
                  indicator.setAttribute('aria-current', 'true');
                }
                indicator.setAttribute('aria-label', `Slide ${i + 1}`);
                indicators.appendChild(indicator);
              }

              carousel.insertBefore(indicators, carouselInner);
            }

            // Initialize the Bootstrap carousel
            try {
              new bootstrap.Carousel(carousel, {
                interval: false, // Don't auto-advance slides
                wrap: false, // Don't loop back to first slide
                keyboard: true, // Allow keyboard navigation
              });
              console.log('✅ Bootstrap carousel initialized successfully');
            } catch (error) {
              console.error('❌ Error initializing Bootstrap carousel:', error);
            }
          }
        }
      }, 100);
    }

    if (lesson.learning_objectives && lesson.learning_objectives.length > 0) {
      const objectivesBlock = document.createElement('div');
      objectivesBlock.className = 'lesson-objectives-block';
      objectivesBlock.style.cssText = `
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 10px;
        border-left: 4px solid #4facfe;
      `;
      objectivesBlock.innerHTML = `<h4>🎯 Learning Objectives:</h4><ul>${lesson.learning_objectives.map(obj => `<li>${obj}</li>`).join('')}</ul>`;
      contentContainer.appendChild(objectivesBlock);
    }

    modalDialog.appendChild(contentContainer);
    const beginButton = document.createElement('button');
    beginButton.textContent = 'Begin Activities';
    beginButton.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      font-size: 16px;
      font-weight: bold;
      color: white;
      background: #3498db;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    beginButton.addEventListener('click', () => {
      if (window.lessonEngine && window.lessonEngine.initialized) {
        console.log('🟢 Begin Activities clicked - activating lesson via UI');
        window.lessonEngine.activateLesson(lesson).catch(err => {
          console.error('❌ Failed to activate lesson in lesson engine:', err);
        });
      } else {
        console.warn(
          '⚠️ Lesson engine is not initialized. Tracking will not be active.',
        );
      }
    });
    modalDialog.appendChild(beginButton);

    modalOverlay.appendChild(modalDialog);
    document.body.appendChild(modalOverlay);

    // Add keyboard event listener to close modal on Escape key
    const escapeKeyHandler = event => {
      if (event.key === 'Escape') {
        this.closeModal(modalOverlay);
        document.removeEventListener('keydown', escapeKeyHandler);
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    // Add click event listener to close modal when clicking outside the dialog
    modalOverlay.addEventListener('click', event => {
      if (event.target === modalOverlay) {
        this.closeModal(modalOverlay);
      }
    });

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
  }

  /**
   * Display a list of lessons as circular buttons in a horizontal row
   * @param {Array} lessons - Array of lesson objects to display
   */
  displayLessonsList(lessons) {
    const container = document.querySelector('.lessonsBlock');
    if (!container) {
      console.error('❌ Lessons container not found on the page.');
      return;
    }
    container.innerHTML = '';
    const rowContainer = document.createElement('div');
    rowContainer.style.cssText = `
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 15px;
      padding: 10px;
    `;

    lessons.forEach((lesson, index) => {
      const buttonElement = this.createCircularLessonButton(lesson, index);
      rowContainer.appendChild(buttonElement);
    });

    container.appendChild(rowContainer);
    console.log('✅ Lessons displayed successfully in a horizontal row.');
  }

  /**
   * Render sample lesson content when actual content is missing
   * @param {Element} container - The container element
   * @param {Object} lesson - The lesson object
   */
  renderSampleContent(container, lesson) {
    console.log('📚 Rendering sample content for lesson:', lesson.lesson_title);
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
    this.renderLessonContent(container, sampleContent);
  }

  /**
   * Convert lesson_blocks and intro_text_blocks to content format
   * @param {Object} lesson - The lesson object
   * @returns {Array} Converted content array
   */
  convertLessonBlocksToContent(lesson) {
    const content = [];
    if (lesson.intro_text_blocks && Array.isArray(lesson.intro_text_blocks)) {
      lesson.intro_text_blocks.forEach(block => {
        if (typeof block === 'string') {
          content.push({ type: 'text', content: block });
        } else if (block && block.type && block.content) {
          content.push(block);
        }
      });
    }
    if (lesson.lesson_title) {
      content.push({ type: 'header', content: 'Lesson Introduction' });
      content.push({
        type: 'text',
        content:
          lesson.lesson_description ||
          'This lesson will help you develop important financial skills.',
      });
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
    if (lesson.lesson_blocks && Array.isArray(lesson.lesson_blocks)) {
      lesson.lesson_blocks.forEach(block => {
        if (typeof block === 'string') {
          content.push({ type: 'text', content: block });
        } else if (block && block.type && block.content) {
          content.push(block);
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
    // Validate content input
    if (!Array.isArray(content)) {
      console.error('❌ Cannot process content: not an array', content);
      return [];
    }

    console.log('🔄 Processing content blocks with length:', content.length);

    const processedBlocks = [];
    let currentGroup = null;

    // Architecture rules from LESSON_ENGINE_ARCHITECTURE.md:
    // - Headers + text blocks are grouped
    // - Multiple text blocks with no header appear standalone
    // - Consecutive headers render independently

    for (let i = 0; i < content.length; i++) {
      const block = content[i];

      // Skip invalid blocks
      if (!block || !block.type) {
        console.warn('⚠️ Skipping invalid content block:', block);
        continue;
      }

      if (block.type === 'header') {
        // If we have a previous group, push it to processed blocks
        if (currentGroup) {
          processedBlocks.push(currentGroup);
        }

        // Check if next block is also a header (consecutive headers)
        const nextBlock = content[i + 1];
        if (nextBlock && nextBlock.type === 'header') {
          // Render consecutive headers independently
          processedBlocks.push({
            type: 'standalone_header',
            content: [block],
          });
          currentGroup = null;
        } else {
          // Start a new header group
          currentGroup = {
            type: 'header_group',
            content: [block],
          };
        }
      } else if (block.type === 'text') {
        if (currentGroup && currentGroup.type === 'header_group') {
          // Add text to existing header group
          currentGroup.content.push(block);
        } else {
          // Handle text block without a header
          if (!currentGroup || currentGroup.type !== 'text_group') {
            // If we have a previous non-text group, push it
            if (currentGroup) {
              processedBlocks.push(currentGroup);
            }
            // Start a new text group
            currentGroup = {
              type: 'text_group',
              content: [],
            };
          }
          // Add text to text group
          currentGroup.content.push(block);
        }
      } else {
        // Handle other content types
        if (currentGroup) {
          processedBlocks.push(currentGroup);
          currentGroup = null;
        }

        // Add standalone content
        processedBlocks.push({
          type: 'standalone_content',
          content: [block],
        });
      }
    }

    // Add the last group if any
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
      width: 100%;
      max-width: 700px;
      height: 450px;
      overflow-y: auto;
      margin: 0 auto;
      background: rgba(25, 33, 52, 0.95); /* Darker background for better contrast */
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.15);
      border-left: 5px solid ${this.getBlockColor(block.type)};
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      position: relative;
      color: #ffffff; /* Light text for contrast */
    `;

    // Add subtle indication of block index/position
    const positionIndicator = document.createElement('div');
    positionIndicator.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 10px;
      font-size: 12px;
      color: rgba(255,255,255,0.7);
      padding: 3px 8px;
      border-radius: 10px;
      background: rgba(255,255,255,0.1);
    `;
    positionIndicator.textContent = `${index + 1}`;
    blockContainer.appendChild(positionIndicator);

    // Add hover effects
    blockContainer.addEventListener('mouseenter', () => {
      blockContainer.style.transform = 'translateY(-5px)';
      blockContainer.style.boxShadow = '0 15px 30px rgba(0,0,0,0.12)';
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
      default:
        console.warn('⚠️ Unknown block type:', block.type);
        const errorDiv = document.createElement('div');
        errorDiv.textContent = `Unknown block type: ${block.type}`;
        blockContainer.appendChild(errorDiv);
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
    content.forEach((item, index) => {
      if (item.type === 'header') {
        const header = document.createElement('h2');
        header.textContent = item.content;
        header.style.cssText = `
          color: #ffffff;
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 15px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        `;
        container.appendChild(header);
      } else if (item.type === 'text') {
        const paragraph = document.createElement('p');
        paragraph.textContent = item.content;
        paragraph.style.cssText = `
          color: rgba(255,255,255,0.9);
          font-size: 1.1rem;
          line-height: 1.7;
          margin-bottom: 15px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        container.appendChild(paragraph);
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
      const paragraph = document.createElement('p');
      paragraph.textContent = item.content;
      paragraph.style.cssText = `
        color: rgba(255,255,255,0.9);
        font-size: ${index === 0 ? '1.2rem' : '1.1rem'};
        line-height: 1.7;
        margin-bottom: 15px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        ${index === 0 ? 'font-weight: 600;' : ''}
        ${index === 0 ? 'border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;' : ''}
      `;
      container.appendChild(paragraph);
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
      color: #ffffff;
      font-size: 2rem;
      font-weight: 700;
      text-align: center;
      margin: 0;
      background: linear-gradient(135deg, #f5576c, #f093fb);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 10px 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
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
      color: rgba(255,255,255,0.9);
      font-size: 1.1rem;
      line-height: 1.8;
      text-align: center;
      font-style: italic;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: rgba(255,255,255,0.1);
      padding: 15px;
      border-radius: 8px;
      margin: 10px 0;
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
    console.log('🎯 Generating lesson instructions via lesson engine...');
    const specificInstructions = this.generateLessonEngineInstructions(lesson);

    specificInstructions.forEach((instruction, index) => {
      const instructionItem = document.createElement('div');
      instructionItem.className = 'instruction-item';
      instructionItem.style.cssText = `
        background: rgba(255, 255, 255, 0.15);
        padding: 15px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 15px;
      `;

      const icon = document.createElement('div');
      icon.innerHTML = instruction.icon || '📌';
      icon.style.cssText = `
        font-size: 24px;
        min-width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
      `;

      const text = document.createElement('div');
      text.innerHTML = `
        <strong>${instruction.title || 'Task ' + (index + 1)}</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">${instruction.description || instruction.text}</p>
      `;

      instructionItem.appendChild(icon);
      instructionItem.appendChild(text);
      instructionsList.appendChild(instructionItem);
    });

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

    beginButton.addEventListener('click', async () => {
      if (window.lessonEngine) {
        try {
          await this.activateLessonTracking(lesson);
          const modalOverlay = instructionsContainer.closest('.modal-overlay');
          if (modalOverlay) {
            this.closeModal(modalOverlay);
          }
        } catch (error) {
          console.error('❌ Error activating lesson:', error);
        }
      } else {
        console.warn('⚠️ Lesson engine not available');
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
          icon: '<i class="fas fa-book"></i>',
          title: 'Complete the lesson activities',
          description: 'Follow the guidance provided to complete this lesson.',
          location: 'Use the Trinity Capital app features',
        },
      ];
    }

    // Get current student profile if available
    this.currentStudentProfile =
      this.currentStudentProfile ||
      window.currentStudentProfile ||
      window.studentProfile;

    if (!this.currentStudentProfile) {
      console.warn(
        '⚠️ No student profile found for condition validation, showing all instructions',
      );
    } else {
      console.log(
        '✅ Using student profile for condition validation:',
        this.currentStudentProfile.memberName || 'Unknown student',
      );
    }

    lesson.lesson_conditions.forEach((condition, index) => {
      const instruction = this.interpretConditionToInstruction(
        condition,
        lesson,
      );
      if (instruction) {
        instructions.push(instruction);
      }
    });

    if (instructions.length === 0) {
      instructions.push({
        icon: '<i class="fas fa-bullseye"></i>',
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

    // Get the appropriate template from instructionTemplates based on condition type
    const template = instructionTemplates[condition.condition_type];

    // Check if this condition should be shown based on account status
    if (this.shouldShowCondition(condition, lesson) === false) {
      console.log(
        `⏭️ Skipping condition ${condition.condition_type} - not applicable to current account state`,
      );
      return null;
    }

    // If we have a matching template
    if (template) {
      // Replace emoji icons with Font Awesome icons for better cross-platform compatibility
      let icon = template.icon;

      // Convert common emoji icons to Font Awesome equivalents
      const emojiToFontAwesome = {
        '💰': '<i class="fas fa-money-bill-wave"></i>',
        '⚠️': '<i class="fas fa-exclamation-triangle"></i>',
        '🏦': '<i class="fas fa-university"></i>',
        '📉': '<i class="fas fa-chart-line"></i>',
        '💎': '<i class="fas fa-gem"></i>',
        '📊': '<i class="fas fa-chart-bar"></i>',
        '⚖️': '<i class="fas fa-balance-scale"></i>',
        '💸': '<i class="fas fa-exchange-alt"></i>',
        '💵': '<i class="fas fa-money-bill-alt"></i>',
        '💳': '<i class="fas fa-credit-card"></i>',
        '🔔': '<i class="fas fa-bell"></i>',
        '📅': '<i class="fas fa-calendar-alt"></i>',
        '💼': '<i class="fas fa-briefcase"></i>',
        '📝': '<i class="fas fa-edit"></i>',
        '📋': '<i class="fas fa-clipboard"></i>',
        '🔍': '<i class="fas fa-search"></i>',
        '📈': '<i class="fas fa-chart-line"></i>',
        '🎯': '<i class="fas fa-bullseye"></i>',
        '🏆': '<i class="fas fa-trophy"></i>',
        '⏱️': '<i class="fas fa-stopwatch"></i>',
        '📢': '<i class="fas fa-bullhorn"></i>',
        '🔄': '<i class="fas fa-sync"></i>',
      };

      // Replace emoji with Font Awesome icon if available
      if (emojiToFontAwesome[icon]) {
        icon = emojiToFontAwesome[icon];
      } else {
        // Default icon if no match found
        icon = '<i class="fas fa-clipboard-list"></i>';
      }

      // Enhance description with any additional details from the condition
      let enhancedDescription = template.description;

      // Add condition-specific values to make instructions more precise
      if (condition.condition_value) {
        // Handle different condition types with specific formatting
        if (condition.condition_type.includes('balance')) {
          enhancedDescription = enhancedDescription.replace(
            'the target amount',
            `$${parseFloat(condition.condition_value).toFixed(2)}`,
          );
        } else if (condition.condition_type.includes('transfer')) {
          enhancedDescription = enhancedDescription.replace(
            'the specified amount',
            `$${parseFloat(condition.condition_value).toFixed(2)}`,
          );
        }
      }

      // Add any additional messages from the action details
      if (condition.action_details?.message) {
        enhancedDescription += ` ${condition.action_details.message}`;
      }

      return {
        icon: icon,
        title: template.title,
        description: enhancedDescription,
        location: template.location,
        priority: condition.action_details?.priority || 'medium',
        autoTrigger: condition.action_details?.auto_trigger || false,
      };
    }

    // Fallback template if no matching template is found
    console.warn(
      `No template found for condition type: ${condition.condition_type}`,
    );
    const fallbackTemplate = {
      icon: '<i class="fas fa-clipboard-list"></i>',
      title: `Complete action: ${condition.condition_type || 'Task'}`,
      description: `Perform the required action: ${condition.condition_value || 'Complete the task'}`,
      location: 'Use the appropriate section in the app',
    };

    // Add any additional messages from the action details
    let fallbackDescription = fallbackTemplate.description;
    if (condition.action_details?.message) {
      fallbackDescription += ` ${condition.action_details.message}`;
    }

    return {
      ...fallbackTemplate,
      description: fallbackDescription,
      priority: condition.action_details?.priority || 'medium',
      autoTrigger: condition.action_details?.auto_trigger || false,
    };
  }

  /**
   * Activate lesson tracking and initialize lesson engine
   * @param {Object} lesson - The lesson object
   */
  async activateLessonTracking(lesson) {
    console.log(
      '%c 🚀 Activating lesson tracking for: ' + lesson.lesson_title,
      'background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;',
    );

    // Initialize lesson engine if available
    if (window.lessonEngine) {
      // Set the current lesson for tracking
      window.lessonEngine.currentLesson = lesson;
      console.log(
        '✅ Lesson set for tracking:',
        lesson.lesson_id || lesson._id,
      );

      // Initialize the engine for this student if not already done
      if (!window.lessonEngine.initialized) {
        await window.lessonEngine.initialize(this.currentStudent);
        console.log('🔍 Lesson engine initialized for student');
      }

      // Make sure the lesson has conditions
      if (lesson.lesson_conditions && Array.isArray(lesson.lesson_conditions)) {
        console.log(
          `📋 Lesson has ${lesson.lesson_conditions.length} conditions`,
        );
        lesson.lesson_conditions.forEach((condition, index) => {
          console.log(
            `  ${index + 1}. ${condition.condition_type || condition.type || 'Unknown condition'}`,
          );
        });
      } else {
        console.warn('⚠️ No conditions found for lesson! Check lesson data.');
      }
      if (typeof window.initializeLessonWithRequirements === 'function') {
        try {
          const result = await window.initializeLessonWithRequirements(lesson);
          console.log('🎯 Lesson requirements initialized:', result);
        } catch (error) {
          console.error('Error initializing lesson requirements:', error);
        }
      }
      try {
        await window.lessonEngine.refreshCurrentLesson();
        console.log('🔄 Refreshed current lesson in engine');
        const testAction = 'lesson_view';
        const testPayload = { lessonId: lesson.lesson_id || lesson._id };

        console.log(
          '🧪 Testing condition evaluation with action:',
          testAction,
          testPayload,
        );
        const matchedConditions = await window.lessonEngine.evaluateConditions(
          testAction,
          testPayload,
        );

        if (matchedConditions && matchedConditions.length > 0) {
          console.log(
            '✅ Matched conditions found during test:',
            matchedConditions,
          );
        } else {
          console.log(
            'ℹ️ No matched conditions for test action. This is normal for initialization.',
          );
        }
      } catch (error) {
        console.error('Error during lesson engine refresh:', error);
      }
    } else {
      console.warn('⚠️ Lesson engine not available for tracking');
    }
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
   * Debug method to check lesson engine status
   * This can be called from the browser console to check if lesson tracking is working
   */
  debugLessonEngine() {
    console.log(
      '%c LESSON ENGINE DEBUG INFO',
      'background: #8e44ad; color: white; padding: 5px; font-size: 14px;',
    );

    if (!window.lessonEngine) {
      console.log(
        '%c ❌ Lesson engine not found!',
        'color: red; font-weight: bold;',
      );
      return false;
    }

    console.log('%c ✅ Lesson engine instance found', 'color: green;');
    console.log('Initialized:', window.lessonEngine.initialized);
    console.log('Current Student:', window.lessonEngine.currentStudent);

    if (window.lessonEngine.currentLesson) {
      console.log('%c 📚 Current Lesson:', 'color: blue; font-weight: bold;');
      console.log('  Title:', window.lessonEngine.currentLesson.lesson_title);
      console.log(
        '  ID:',
        window.lessonEngine.currentLesson.lesson_id ||
          window.lessonEngine.currentLesson._id,
      );

      if (window.lessonEngine.currentLesson.lesson_conditions) {
        console.log('%c 🎯 Conditions:', 'color: orange; font-weight: bold;');
        window.lessonEngine.currentLesson.lesson_conditions.forEach(
          (condition, index) => {
            console.log(
              `  ${index + 1}. Type: ${condition.condition_type}, Value: ${condition.condition_value || condition.value}`,
            );
          },
        );
      } else {
        console.log(
          '%c ❌ No conditions found in current lesson!',
          'color: red;',
        );
      }

      if (window.lessonEngine.lessonTracker) {
        console.log(
          '%c 📊 Tracker State:',
          'color: purple; font-weight: bold;',
        );
        console.log(
          '  Positive Conditions:',
          window.lessonEngine.lessonTracker.getPositiveConditionsCount(),
        );
        console.log(
          '  Negative Conditions:',
          window.lessonEngine.lessonTracker.getNegativeConditionsCount(),
        );
      }
    } else {
      console.log('%c ❌ No current lesson set in engine!', 'color: red;');
    }

    return true;
  }

  /**
   * Generate sample content for a lesson when actual content is missing
   * @param {Object} lesson - The lesson object
   * @returns {Array} Sample content array
   */
  generateSampleContent(lesson) {
    console.log(
      '📚 Generating sample content for lesson:',
      lesson?.lesson_title,
    );

    // Default content for any lesson
    const defaultContent = [
      {
        type: 'header',
        content: lesson?.lesson_title || 'Lesson Introduction',
      },
      {
        type: 'text',
        content:
          lesson?.lesson_description ||
          'This lesson will help you develop important financial skills.',
      },
      { type: 'header', content: 'Key Concepts' },
      {
        type: 'text',
        content:
          'You will learn practical financial concepts that apply to real-world situations.',
      },
      {
        type: 'text',
        content:
          'These skills will help you make better financial decisions in your daily life.',
      },
      { type: 'header', content: 'Learning Objectives' },
      {
        type: 'text',
        content:
          'By the end of this lesson, you will be able to apply these concepts in practical scenarios.',
      },
    ];

    // If we have a lesson with a specific title, add more tailored content
    if (lesson && lesson.lesson_title) {
      const title = lesson.lesson_title.toLowerCase();

      if (title.includes('money personality')) {
        return [
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
        ];
      } else if (title.includes('budget')) {
        return [
          { type: 'header', content: 'Building a Personal Budget' },
          {
            type: 'text',
            content:
              'A budget is a financial plan that helps you track income and expenses over a specific period.',
          },
          {
            type: 'text',
            content:
              'Creating and following a budget is one of the most effective ways to manage your money and reach financial goals.',
          },
          { type: 'header', content: 'The 50/30/20 Rule' },
          {
            type: 'text',
            content: 'A popular budgeting approach is the 50/30/20 rule:',
          },
          {
            type: 'text',
            content:
              '50% for needs: housing, utilities, groceries, transportation, and other essentials.',
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
        ];
      }
    }

    return defaultContent;
  }

  /**
   * Format a condition type for display to the user
   * @param {string} conditionType - The condition type from the lesson
   * @returns {string} Human-readable condition description
   */
  /**
   * Determine if a condition should be shown based on the current account state
   * @param {Object} condition - The lesson condition
   * @param {Object} lesson - The full lesson object
   * @returns {boolean} Whether the condition should be displayed
   */
  shouldShowCondition(condition, lesson) {
    // If no currentStudentProfile is available, show all conditions
    if (!this.currentStudentProfile && !window.currentStudentProfile) {
      console.log('⚠️ No student profile available, showing all conditions');
      return true;
    }

    const profile = this.currentStudentProfile || window.currentStudentProfile;
    const conditionType = condition.condition_type;
    const conditionValue = condition.condition_value || 0;

    // Special handling for account-specific conditions
    switch (conditionType) {
      // Budget conditions
      case 'budget_positive_above':
        // Only show if the budget is actually positive and above the threshold
        const income = profile.totalIncome || 0;
        const expenses = profile.totalExpenses || 0;
        const budgetSurplus = income - expenses;
        return budgetSurplus > 0 && budgetSurplus >= parseFloat(conditionValue);

      case 'budget_negative':
        // Only show if the budget is actually negative
        const negIncome = profile.totalIncome || 0;
        const negExpenses = profile.totalExpenses || 0;
        return negIncome < negExpenses;

      // Account balance conditions
      case 'checking_balance_above':
        return (
          (profile.accounts?.checking?.balance || 0) >=
          parseFloat(conditionValue)
        );

      case 'checking_balance_below':
        return (
          (profile.accounts?.checking?.balance || 0) <=
          parseFloat(conditionValue)
        );

      case 'savings_balance_above':
        return (
          (profile.accounts?.savings?.balance || 0) >=
          parseFloat(conditionValue)
        );

      case 'savings_balance_below':
        return (
          (profile.accounts?.savings?.balance || 0) <=
          parseFloat(conditionValue)
        );

      case 'bank_balance_above':
        const totalBalance =
          (profile.accounts?.checking?.balance || 0) +
          (profile.accounts?.savings?.balance || 0);
        return totalBalance >= parseFloat(conditionValue);

      case 'bank_balance_below':
        const lowTotalBalance =
          (profile.accounts?.checking?.balance || 0) +
          (profile.accounts?.savings?.balance || 0);
        return lowTotalBalance <= parseFloat(conditionValue);

      // For other conditions not tied to account state, show them all
      default:
        return true;
    }
  }

  formatConditionForDisplay(conditionType) {
    const conditionMap = {
      lesson_content_viewed: 'Review the lesson content',
      account_checked: 'Check your account details',
      spending_analyzed: 'Analyze your spending patterns',
      bill_created: 'Create a bill payment',
      deposit_completed: 'Make a deposit',
      transfer_completed: 'Complete a transfer between accounts',
      payment_created: 'Create a payment',
      money_sent: 'Send money to someone',
      money_received: 'Receive money from someone',
      account_switched: 'Switch between accounts',
      goal_set_specific: 'Set a savings goal',
      message_sent: 'Send a message',
      personality_insight: 'Identify your money personality type',
      needs_vs_wants: 'Differentiate between needs and wants',
      budget_created: 'Create a budget',
    };

    const formattedText =
      conditionMap[conditionType] || `Complete the "${conditionType}" activity`;
    return `<span style="color: rgba(255,255,255,0.9);">${formattedText}</span>`;
  }

  /**
   * Close modal overlays
   * @param {Element} modalOverlay - The modal overlay element to close
   */
  closeModal(modalOverlay) {
    if (modalOverlay) {
      // Add fade-out animation
      modalOverlay.style.opacity = '0';
      modalOverlay.style.pointerEvents = 'none';

      // Find the dialog element and add slide-out animation
      const dialog = modalOverlay.querySelector('.lesson-modal-dialog');
      if (dialog) {
        dialog.style.transform = 'scale(0.9)';
        dialog.style.opacity = '0';
      }

      setTimeout(() => {
        modalOverlay.remove();
      }, 300);
    }
  }
}

// Expose the LessonRenderer class to the global scope for debugging
window.LessonRenderer = LessonRenderer;

/**
 * Render lessons for a given student profile
 * @param {Object} studentProfile - The student profile object
 */
export async function renderLessons(studentProfile) {
  console.log('🔥 renderLessons called with profile:', studentProfile);
  console.log('🔥 Available containers on page:', {
    lessonsBlock: document.querySelector('.lessonsBlock'),
    'lesson-content': document.getElementById('lesson-content'),
    LessonsBlock: document.querySelector('.LessonsBlock'),
  });

  if (!studentProfile || !studentProfile.memberName) {
    console.error('❌ Invalid student profile provided.');
    return;
  }

  // Store the profile globally for future use
  window.currentStudentProfile = studentProfile;

  if (studentProfile.assignedUnitIds) {
    console.log('✅ Assigned Unit IDs:', studentProfile.assignedUnitIds);
  } else {
    console.warn('⚠️ No assigned Unit IDs found for the student.');
  }

  console.log('🔥 Attempting to initialize lesson renderer...');
  const initialized = window.lessonRenderer.initialize(
    studentProfile.memberName,
    'lessonsBlock',
  );

  console.log('🔥 Initialization result:', initialized);

  if (!initialized) {
    console.error('❌ Failed to initialize lesson renderer.');
    return;
  }

  try {
    const lessons = await window.lessonRenderer.getAvailableLessons();
    console.log('✅ Lessons fetched successfully:', lessons);
    window.lessonRenderer.displayLessonsList(lessons);
  } catch (error) {
    console.error('❌ Error fetching lessons:', error);
    window.lessonRenderer.displayLessonsError();
  }
}

// Ensure global lessonRenderer instance is initialized
if (!window.lessonRenderer) {
  window.lessonRenderer = new LessonRenderer();
  console.log('✅ Global lessonRenderer instance initialized.');
}

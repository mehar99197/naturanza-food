// Custom event system for real-time review updates across components

const REVIEW_EVENTS = {
  REVIEW_SUBMITTED: 'review:submitted',
  REVIEW_UPDATED: 'review:updated',
  REVIEW_DELETED: 'review:deleted',
};

class ReviewEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return cleanup function
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  // Helper method to emit review submitted event
  reviewSubmitted(reviewData) {
    this.emit(REVIEW_EVENTS.REVIEW_SUBMITTED, reviewData);
  }

  // Helper method to listen for review submissions
  onReviewSubmitted(callback) {
    return this.on(REVIEW_EVENTS.REVIEW_SUBMITTED, callback);
  }
}

// Create a singleton instance
const reviewEvents = new ReviewEventEmitter();

export { reviewEvents, REVIEW_EVENTS };
export default reviewEvents;

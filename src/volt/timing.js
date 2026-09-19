export class FixedClock {
  constructor(step = 1 / 60, maxSteps = 12) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.pending = 0;
  }

  advance(seconds, update) {
    // Account for ordinary low FPS, but discard time spent in a background tab
    // or a suspended device instead of simulating a lethal burst on return.
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.5) {
      this.pending = 0;
      return 0;
    }
    this.pending = Math.min(this.pending + seconds, this.step * this.maxSteps);
    let count = 0;
    while (this.pending + 1e-9 >= this.step && count < this.maxSteps) {
      update(this.step);
      this.pending -= this.step;
      count++;
    }
    return count;
  }
}

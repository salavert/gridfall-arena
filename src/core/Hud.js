import { RUNNERS } from '../config.js';
import { formatTime } from './math.js';

const byId = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.menu = byId('menu');
    this.hud = byId('hud');
    this.result = byId('result');
    this.bannerElement = byId('banner');
    this.feedElement = byId('feed');
    this.selected = 'flux';
    this.bannerTimer = 0;
    this.damageTimer = 0;
    this.voidTimer = 0;
    this.buildRunnerCards();
    byId('play-button').addEventListener('click', () => this.game.start(this.selected));
    byId('again-button').addEventListener('click', () => this.game.start(this.selected));
    byId('menu-button').addEventListener('click', () => this.showMenu());
    byId('dash-button').addEventListener('click', () => { this.game.input.dashQueued = true; });
    byId('overdrive-button').addEventListener('click', () => { this.game.input.overdriveQueued = true; });
  }

  buildRunnerCards() {
    const container = byId('runner-cards');
    container.replaceChildren();
    for (const runner of Object.values(RUNNERS)) {
      const card = document.createElement('button');
      card.className = `runner-card${runner.id === this.selected ? ' is-selected' : ''}`;
      card.style.setProperty('--runner', `#${runner.color.toString(16).padStart(6, '0')}`);
      card.innerHTML = `
        <span class="runner-emblem"></span>
        <span class="runner-info"><strong>${runner.name}</strong><small>${runner.role}</small><p>${runner.description}</p></span>
        <span class="stats">
          <span class="stat">ARMOR<i><b style="width:${runner.stats[0]}%"></b></i></span>
          <span class="stat">SPEED<i><b style="width:${runner.stats[1]}%"></b></i></span>
          <span class="stat">POWER<i><b style="width:${runner.stats[2]}%"></b></i></span>
        </span>`;
      card.addEventListener('click', () => {
        this.selected = runner.id;
        container.querySelectorAll('.runner-card').forEach((element) => element.classList.remove('is-selected'));
        card.classList.add('is-selected');
        this.game.audio.unlock();
        this.game.audio.play('pickup');
      });
      container.append(card);
    }
  }

  showMenu() {
    this.game.toMenu();
    this.menu.classList.add('is-open');
    this.result.classList.remove('is-open');
    this.hud.classList.add('is-hidden');
  }

  showGame() {
    this.menu.classList.remove('is-open');
    this.result.classList.remove('is-open');
    this.hud.classList.remove('is-hidden');
  }

  showResult(won, player, rank, elapsed) {
    this.hud.classList.add('is-hidden');
    this.result.classList.add('is-open');
    byId('result-title').textContent = won ? 'GRID SECURED' : 'SIGNAL LOST';
    byId('result-title').style.color = won ? 'var(--cyan)' : 'var(--danger)';
    byId('result-kicker').lastChild.textContent = won ? ' PROTOCOL COMPLETE' : ' RUN TERMINATED';
    byId('result-copy').textContent = won
      ? 'You turned the collapsing arena into a weapon and outlasted every rival.'
      : 'The grid took your signal. Read the warning tiles, trigger relays earlier, and keep an exit route.';
    byId('result-rank').textContent = `#${rank}`;
    byId('result-kills').textContent = player.kills;
    byId('result-time').textContent = formatTime(elapsed);
  }

  banner(text, duration = 1.4, color = 'var(--white)') {
    this.bannerTimer = duration;
    this.bannerElement.textContent = text;
    this.bannerElement.style.color = color;
    this.bannerElement.classList.add('is-shown');
  }

  feed(text) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.textContent = text;
    this.feedElement.prepend(item);
    while (this.feedElement.children.length > 4) this.feedElement.lastElementChild.remove();
    setTimeout(() => item.remove(), 4200);
  }

  flashDamage() {
    this.damageTimer = 0.26;
  }

  update(dt) {
    this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) this.bannerElement.classList.remove('is-shown');
    this.damageTimer = Math.max(0, this.damageTimer - dt);
    byId('damage-vignette').style.opacity = String(Math.min(1, this.damageTimer * 4));
    const player = this.game.player;
    if (!player) return;
    const hp = Math.max(0, player.hp / player.maxHp);
    byId('pilot-name').textContent = player.definition.name;
    byId('health-label').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`;
    byId('health-fill').style.transform = `scaleX(${hp})`;
    byId('health-fill').style.background = hp < 0.3 ? 'var(--danger)' : '';
    byId('heat-fill').style.transform = `scaleX(${Math.min(1, player.heat)})`;
    byId('heat-label').textContent = player.heat >= 1 ? 'VENTING' : player.fireCooldown > 0 ? 'CYCLING' : 'READY';
    byId('shard-count').textContent = player.shards;
    byId('weapon-level').textContent = `PULSE MK ${['I', 'II', 'III'][player.weaponLevel - 1]}`;
    byId('dash-cooldown').style.transform = `scaleX(${1 - Math.min(1, player.dashCooldown / 3.4)})`;
    byId('core-charge').style.transform = `scaleX(${player.core})`;
    byId('rivals-left').textContent = this.game.runners.filter((runner) => runner.alive && runner !== player).length;
    byId('phase-time').textContent = formatTime(this.game.matchTime);
    const collapseIn = this.game.config.collapseStart - this.game.matchTime;
    byId('phase-label').textContent = collapseIn > 0 ? `COLLAPSE IN ${Math.ceil(collapseIn)}S` : 'GRID COLLAPSING';
    byId('phase-label').style.color = collapseIn > 0 ? 'var(--cyan)' : 'var(--danger)';
    const inVoid = this.game.arena?.isVoid(player.x, player.z);
    byId('void-vignette').style.opacity = inVoid ? '1' : '0';
    const crosshair = byId('crosshair');
    crosshair.style.left = `${this.game.input.pointerPixels.x}px`;
    crosshair.style.top = `${this.game.input.pointerPixels.y}px`;
  }
}

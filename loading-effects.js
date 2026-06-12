class Particle {
    constructor(x, y, vx, vy, size, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color;
        this.life = life;
        this.alpha = 1;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.alpha = Math.max(0, this.life / 1);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.spawnRate = 0;
        this.maxParticles = 200;
    }

    update(dt) {
        this.spawnRate += dt;
        if (this.spawnRate > 0.1 && this.particles.length < this.maxParticles) {
            this.spawnParticle();
            this.spawnRate = 0;
        }
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    spawnParticle() {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        const size = 1 + Math.random() * 2;
        const color = `hsl(${Math.random() * 360}, 70%, 70%)`;
        
        this.particles.push(
            new Particle(
                450 + (Math.random() - 0.5) * 100,
                300 + (Math.random() - 0.5) * 100,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                size,
                color,
                1.5 + Math.random() * 1.5
            )
        );
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}
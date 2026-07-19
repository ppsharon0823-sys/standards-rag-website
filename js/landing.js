/**
 * TUPDI 城市更新工具箱 - Landing Page 互动效果
 */

// ===== 光标跟随发光 =====
const cursorGlow = document.getElementById('cursor-glow');
if (cursorGlow) {
    let mouseX = 0, mouseY = 0;
    let glowX = 0, glowY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    function animateGlow() {
        glowX += (mouseX - glowX) * 0.1;
        glowY += (mouseY - glowY) * 0.1;
        cursorGlow.style.left = glowX + 'px';
        cursorGlow.style.top = glowY + 'px';
        requestAnimationFrame(animateGlow);
    }
    animateGlow();
}

// ===== 卡片 3D 倾斜 + 发光层跟随 =====
document.querySelectorAll('.tool-card:not(.disabled)').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // 3D 倾斜
        const rotateX = (y - centerY) / centerY * -8;
        const rotateY = (x - centerX) / centerX * 8;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        
        // 发光层位置
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    });
});

// ===== 入场动画增强：随机浮动粒子（可选） =====
function createParticle() {
    const particle = document.createElement('div');
    particle.style.cssText = `
        position: fixed;
        width: 2px; height: 2px;
        background: rgba(0,212,255,0.3);
        border-radius: 50%;
        pointer-events: none;
        z-index: 0;
        left: ${Math.random() * 100}vw;
        top: ${Math.random() * 100}vh;
        animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
    `;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 7000);
}

// 偶尔生成粒子
setInterval(() => {
    if (Math.random() > 0.7) createParticle();
}, 2000);

// CSS 动画注入
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
        50% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
    }
`;
document.head.appendChild(style);

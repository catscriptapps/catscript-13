<?php
// /resources/views/components/hero-slideshow.php
//
// Crossfading, slowly-zooming photo slideshow for a hero. Include it inside a
// `position: relative; overflow: hidden` section, then add your own overlay
// and content after it. The motion lives in app.css (.hero-slide) and the
// crossfade is driven by pages/home-page.js — no inline <style>, because the
// SPA router strips those from partial page loads.
//
// @var string[] $slideshowImages

declare(strict_types=1);

/** @var string[] $slideshowImages */
?>
<?php if (!empty($slideshowImages)): ?>
    <div class="absolute inset-0" aria-hidden="true" data-hero-slides>
        <?php foreach ($slideshowImages as $i => $src): ?>
            <div class="hero-slide absolute inset-0 bg-cover bg-center <?= $i === 0 ? 'is-active' : '' ?>"
                style="background-image: url('<?= htmlspecialchars($src) ?>');"></div>
        <?php endforeach; ?>
    </div>
<?php endif; ?>

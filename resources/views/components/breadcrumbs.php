<?php
// /resources/views/components/breadcrumbs.php
//
// Renders a breadcrumb trail. The including page sets $breadcrumbs before
// including this — an ordered array of ['label' => string, 'href' =>
// string|null]. The last entry (or any entry with a null/empty href)
// renders as plain current-page text instead of a link. Optionally set
// $breadcrumbAccent ('primary'|'secondary'|'indigo'|'teal'|'purple', matches
// each project's own accent) to theme the hover color — defaults
// to 'primary'.
//
// Usage (top of a page file, before its hero/header content):
//   $breadcrumbs = [
//       ['label' => 'Contractor Discovery', 'href' => $baseUrl . 'contractor-discovery'],
//       ['label' => 'Job Requests'],
//   ];
//   include __DIR__ . '/../components/breadcrumbs.php';
//
// @var array<int, array{label: string, href?: ?string}> $breadcrumbs
// @var string|null $breadcrumbAccent
// @var string $baseUrl

declare(strict_types=1);

if (empty($breadcrumbs)) {
    return;
}

$accentHoverClasses = [
    'primary' => 'hover:text-primary-600 dark:hover:text-primary-400',
    'secondary' => 'hover:text-secondary-600 dark:hover:text-secondary-400',
    'indigo' => 'hover:text-indigo-600 dark:hover:text-indigo-400',
    'teal' => 'hover:text-teal-600 dark:hover:text-teal-400',
    'purple' => 'hover:text-purple-600 dark:hover:text-purple-400',
][$breadcrumbAccent ?? 'primary'] ?? 'hover:text-primary-600 dark:hover:text-primary-400';

$lastIndex = count($breadcrumbs) - 1;
?>
<nav aria-label="Breadcrumb" class="mb-4">
    <ol class="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <li class="flex items-center">
            <a href="<?= $baseUrl ?>" data-partial class="flex items-center gap-1 <?= $accentHoverClasses ?> transition-colors">
                <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                <span>Home</span>
            </a>
        </li>
        <?php foreach ($breadcrumbs as $i => $crumb): ?>
            <li class="flex items-center gap-1.5 min-w-0">
                <svg class="h-3.5 w-3.5 text-gray-300 dark:text-gray-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                <?php if (!empty($crumb['href']) && $i < $lastIndex): ?>
                    <a href="<?= htmlspecialchars($crumb['href']) ?>" data-partial class="<?= $accentHoverClasses ?> transition-colors truncate max-w-[9rem] sm:max-w-xs">
                        <?= htmlspecialchars($crumb['label']) ?>
                    </a>
                <?php else: ?>
                    <span class="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[9rem] sm:max-w-xs" aria-current="page">
                        <?= htmlspecialchars($crumb['label']) ?>
                    </span>
                <?php endif; ?>
            </li>
        <?php endforeach; ?>
    </ol>
</nav>

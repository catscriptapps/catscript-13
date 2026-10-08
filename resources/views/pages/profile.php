<?php
// /resources/views/pages/profile.php
//
// The signed-in user's own profile. Renders inside the app shell's normal
// content container (no full-bleed tricks — those shifted the page under
// the fixed sidebar). The ids / data-* hooks below are what
// utils/profile/profile-avatar.js (photo preview, upload, delete, edit,
// live field sync) and utils/users/form-submit.js (#partial-profile
// refresh) rely on — keep them if you restyle this page.

use App\Utils\IdEncoder;

/** @var \App\Models\User $currentUser */
/** @var string $assetBase */
/** @var string $baseUrl */

$user = $currentUser;

$fullName = $user->full_name;
$initials = strtoupper(substr($user->first_name ?: 'U', 0, 1));
$statusIsActive = ((int) $user->status_id === \App\Models\User::STATUS_CURRENT);

$regionName = $user->region->region ?? '';
$countryName = $user->country->country ?? '';
$locationParts = array_filter([$user->city, $regionName]);

$hasAvatar = !empty($user->avatar_url);
$avatarUrl = $hasAvatar ? htmlspecialchars($assetBase . 'images/uploads/avatars/' . $user->avatar_url) : '';
$encodedId = IdEncoder::encode((int) $user->id);

if (!isset($GLOBALS['allUserTypes'])) {
    $GLOBALS['allUserTypes'] = [];
    foreach (\Src\Controller\UserTypesController::list() as $t) {
        $GLOBALS['allUserTypes'][$t->user_type_id] = $t->user_type;
    }
}
$roleNames = array_map(
    fn($tid) => (string) ($GLOBALS['allUserTypes'][$tid] ?? 'User'),
    $user->user_type_ids ?: [2]
);

// One label/value row in the details cards.
$detailRow = function (string $label, string $value, string $field = '', bool $muted = false): string {
    $fieldAttr = $field !== '' ? ' data-field="' . $field . '"' : '';
    $valueClass = $muted ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-900 dark:text-white';
    return '<div class="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">'
        . '<dt class="sm:w-32 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">' . htmlspecialchars($label) . '</dt>'
        . '<dd class="text-sm font-medium break-words ' . $valueClass . '"' . $fieldAttr . '>' . htmlspecialchars($value) . '</dd>'
        . '</div>';
};
?>

<div id="partial-profile" class="space-y-6">
    <div id="profile-page-container" class="space-y-6">

        <?php
        $breadcrumbs = [['label' => 'Profile']];
        include __DIR__ . '/../components/breadcrumbs.php';
        ?>

        <!-- Profile header -->
        <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="h-24 bg-gradient-to-r from-secondary-500 to-secondary-900"></div>

            <div class="px-6 pb-6">
                <div class="flex flex-col sm:flex-row sm:items-start gap-5 -mt-12">

                    <!-- Photo + its controls, kept together -->
                    <div class="flex flex-col items-center sm:items-start gap-3 flex-shrink-0">
                        <div class="relative group" id="avatar-preview-wrapper">
                            <div id="avatar-container"
                                data-action="view-avatar"
                                data-img-src="<?= $avatarUrl ?>"
                                class="h-28 w-28 rounded-2xl overflow-hidden ring-4 ring-white dark:ring-gray-900 shadow-lg bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center <?= $hasAvatar ? 'cursor-zoom-in' : '' ?>">
                                <span id="avatar-initial" class="text-4xl font-bold text-white <?= $hasAvatar ? 'hidden' : 'block' ?>"><?= $initials ?></span>
                                <img id="avatar-img" src="<?= $avatarUrl ?>" alt="Profile photo"
                                    class="w-full h-full object-cover <?= $hasAvatar ? 'block' : 'hidden' ?>">
                            </div>
                            <input type="file" id="avatar-file-input" class="hidden" accept="image/*">
                        </div>

                        <div class="flex items-center gap-2">
                            <button type="button" id="change-avatar-btn" data-action="upload"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <?= $hasAvatar ? 'Change photo' : 'Upload photo' ?>
                            </button>
                            <span id="delete-avatar-container" style="display: <?= $hasAvatar ? 'inline-flex' : 'none' ?>;">
                                <button type="button" id="delete-avatar-btn" data-action="delete-avatar" data-id="<?= $encodedId ?>"
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Remove
                                </button>
                            </span>
                        </div>
                    </div>

                    <!-- Name + edit -->
                    <div class="flex-1 min-w-0 flex flex-col md:flex-row md:items-end md:justify-between gap-4 text-center sm:text-left sm:pt-14">
                        <div class="min-w-0">
                            <h1 class="text-2xl font-bold text-gray-900 dark:text-white break-words" data-field="fullName"><?= htmlspecialchars($fullName) ?></h1>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate" data-field="email"><?= htmlspecialchars($user->email) ?></p>
                            <div class="mt-2 flex flex-wrap justify-center sm:justify-start gap-1.5">
                                <?php foreach ($roleNames as $roleName): ?>
                                    <span class="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300"><?= htmlspecialchars($roleName) ?></span>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <button type="button"
                            data-action="edit-user-profile"
                            data-encoded-id="<?= $encodedId ?>"
                            data-first-name="<?= htmlspecialchars($user->first_name) ?>"
                            data-last-name="<?= htmlspecialchars($user->last_name) ?>"
                            data-full-name="<?= htmlspecialchars($user->full_name) ?>"
                            data-email="<?= htmlspecialchars($user->email) ?>"
                            data-city="<?= htmlspecialchars($user->city ?? '') ?>"
                            data-country-id="<?= $user->country_id ?? 0 ?>"
                            data-region-id="<?= $user->region_id ?? 0 ?>"
                            data-is-active="<?= $statusIsActive ? '1' : '0' ?>"
                            data-avatar-url="<?= htmlspecialchars($user->avatar_url ?? '') ?>"
                            data-is-protected="<?= in_array((int) $user->id, [1, 2], true) ? '1' : '0' ?>"
                            data-user-type-ids='<?= json_encode($user->user_type_ids ?? []) ?>'
                            data-permitted-apps='<?= htmlspecialchars(json_encode(array_values((array) ($user->permitted_apps ?? []))), ENT_QUOTES) ?>'
                            class="self-center sm:self-start md:self-auto flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-secondary-900 hover:bg-secondary-800 dark:bg-white/10 dark:hover:bg-white/20 text-white shadow-sm transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Edit profile
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Details -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6">
                <h2 class="text-base font-bold text-gray-900 dark:text-white mb-2">Contact details</h2>
                <dl>
                    <?= $detailRow('Email', (string) $user->email, 'email') ?>
                    <?= $detailRow('Phone', $user->phone ?: 'Not set', 'phone', !$user->phone) ?>
                    <?= $detailRow('Address', $user->address ?: 'Not set', 'address', !$user->address) ?>
                    <div class="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 py-3">
                        <dt class="sm:w-32 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Location</dt>
                        <dd class="text-sm font-medium text-gray-900 dark:text-white">
                            <?php if ($locationParts || $countryName): ?>
                                <span data-field="city"><?= htmlspecialchars(implode(', ', $locationParts)) ?></span><span class="text-gray-500 dark:text-gray-400" data-field="countryName"><?= $countryName ? ' (' . htmlspecialchars($countryName) . ')' : '' ?></span>
                            <?php else: ?>
                                <span class="text-gray-400 dark:text-gray-500 italic">Not set</span>
                            <?php endif; ?>
                        </dd>
                    </div>
                </dl>
            </section>

            <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6">
                <h2 class="text-base font-bold text-gray-900 dark:text-white mb-2">Account</h2>
                <dl>
                    <div class="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <dt class="sm:w-32 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</dt>
                        <dd>
                            <?php if ($statusIsActive): ?>
                                <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Active</span>
                            <?php else: ?>
                                <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-400"></span>Archived</span>
                            <?php endif; ?>
                        </dd>
                    </div>
                    <?= $detailRow('Roles', implode(', ', $roleNames)) ?>
                    <?= $detailRow('Member since', $user->created_at ? $user->created_at->format('F j, Y') : '—') ?>
                    <?= $detailRow('Last updated', $user->updated_at ? $user->updated_at->diffForHumans() : '—') ?>
                </dl>
            </section>
        </div>
    </div>
</div>

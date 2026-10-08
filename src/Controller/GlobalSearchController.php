<?php
// /src/Controller/GlobalSearchController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\User;
use App\Utils\IdEncoder;

class GlobalSearchController
{
    public function search(): void
    {
        $query = trim($_GET['q'] ?? '');
        $page = (int)($_GET['page'] ?? 1);
        $perPage = 15;
        $offset = ($page - 1) * $perPage;

        if (empty($query)) {
            echo json_encode(['success' => true, 'html' => '', 'total' => 0]);
            exit;
        }

        $builder = User::with(['country', 'region'])
            ->leftJoin('countries', 'users.country_id', '=', 'countries.country_id')
            ->leftJoin('regions', 'users.region_id', '=', 'regions.region_id')
            ->select('users.*');

        $builder->where(function ($q) use ($query) {
            $q->where('users.full_name', 'LIKE', "%{$query}%")
                ->orWhere('users.email', 'LIKE', "%{$query}%")
                ->orWhere('users.city', 'LIKE', "%{$query}%")
                ->orWhere('countries.country', 'LIKE', "%{$query}%")
                ->orWhere('regions.region', 'LIKE', "%{$query}%");
        });

        $total = $builder->count();
        $users = $builder->orderBy('users.full_name', 'asc')
            ->offset($offset)
            ->limit($perPage)
            ->get();

        $GLOBALS['assetBase'] = getAssetBase();
        $html = '';

        foreach ($users as $user) {
            // Adopt logic from renderCard: Geography & Roles
            $ownerCountry = $user->country->country ?? 'N/A';
            $ownerRegion  = $user->region->region ?? 'N/A';

            // Format: City - Region, Country
            $locationLabel = $user->city . ' - ' . $ownerRegion . ', ' . $ownerCountry;

            // Fetch the roles
            $rolesData = getUserRoles($user);

            // If it's a string (JSON), decode it. If it's already an array, keep it.
            $userTypesArray = is_string($rolesData) ? json_decode($rolesData, true) : $rolesData;

            // Ensure it's at least an empty array so foreach doesn't explode
            $userTypesArray = is_array($userTypesArray) ? $userTypesArray : [];

            $item = (object)[
                'title'          => $user->full_name,
                'location_label' => $locationLabel,
                'avatar_url'     => $user->avatar_url,
                'first_name'     => $user->first_name,
                'user_types'     => $userTypesArray, // Pass the clean ARRAY here
                'modal_attrs'    => [
                    'id'   => IdEncoder::encode((int)$user->id),
                    'name' => $user->full_name,
                ]
            ];

            $html .= $this->renderSearchResultCard($item, 'users');
        }

        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'html'    => $html ?: $this->renderEmptyState(),
            'total'   => $total,
            'hasMore' => ($offset + $users->count()) < $total
        ]);
        exit;
    }

    private function renderSearchResultCard(object $item, string $category): string
    {
        ob_start();
        // Passing variables explicitly to prevent Scope issues
        $assetBase = getAssetBase();
        include __DIR__ . '/../../resources/views/components/search/data-card.php';
        return ob_get_clean();
    }

    private function renderEmptyState(): string
    {
        return '<div class="p-12 text-center text-gray-400 font-medium text-sm italic">No people found.</div>';
    }
}

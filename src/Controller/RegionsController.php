<?php
// /src/Controller/RegionsController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Region;

class RegionsController
{
    /**
     * Return all regions OR regions belonging to a specific country_id
     */
    public static function list(?int $countryId = null)
    {
        $query = Region::query();

        if ($countryId !== null) {
            $query->where('country_id', $countryId);
        }

        return $query->orderBy('region')->get();
    }
}

<?php
// /src/Controller/CountriesController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Country;

class CountriesController
{
    /**
     * Return all countries for the dropdowns
     */
    public static function list()
    {
        // Maps to the legacy table: country_id, country
        return Country::orderBy('country')->get();
    }
}

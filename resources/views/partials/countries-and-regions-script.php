<?php
// /resources/views/partials/countries-and-regions-script.php

declare(strict_types=1);

/** @var \Illuminate\Support\Collection $countries */
/** @var array<string, \Illuminate\Support\Collection> $regionsByCountry */
?>

<script>
    window.COUNTRIES = <?= json_encode($countries->map(fn($c) => ['id' => $c->country_id, 'name' => $c->country])->toArray()) ?>;
    window.REGIONS_BY_COUNTRY = <?= json_encode(array_map(
                                    fn($r) => $r->map(fn($x) => ['id' => $x->region_id, 'name' => $x->region])->toArray(),
                                    $regionsByCountry
                                )) ?>;
</script>
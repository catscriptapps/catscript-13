<?php
// /src/Service/PictureOrderService.php

declare(strict_types=1);

namespace Src\Service;

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Support\Collection;

/**
 * Applies a client-submitted picture order (owner reordering a listing's
 * photos) to a listing's picture rows. Shared by Listings, Quotations and
 * Swap listings, whose picture tables differ only in their id/position
 * column names.
 */
class PictureOrderService
{
    /**
     * @param Collection $pics          The listing's current picture models.
     * @param int[]      $order         Picture ids in the desired order.
     * @param string     $idColumn      Picture primary key column.
     * @param string     $positionColumn Column holding the sort position.
     * @return bool False (nothing written) unless $order is exactly the
     *              listing's current set of picture ids, each once.
     */
    public static function apply(Collection $pics, array $order, string $idColumn, string $positionColumn): bool
    {
        $order = array_values(array_map('intval', $order));
        $existingIds = $pics->pluck($idColumn)->map(fn ($id) => (int) $id)->all();

        if (
            count($order) !== count($existingIds)
            || count(array_unique($order)) !== count($order)
            || array_diff($order, $existingIds) !== []
        ) {
            return false;
        }

        $byId = $pics->keyBy(fn ($pic) => (int) $pic->{$idColumn});

        Capsule::connection()->transaction(function () use ($order, $byId, $positionColumn) {
            foreach ($order as $position => $id) {
                $pic = $byId->get($id);

                if ((int) $pic->{$positionColumn} !== $position) {
                    $pic->{$positionColumn} = $position;
                    $pic->save();
                }
            }
        });

        return true;
    }
}

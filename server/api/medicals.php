<?php
// /server/api/medicals.php
//
// GET                                    -> the whole Medicals state (MedicalsController::state)
// POST {action, ...} (JSON):
//   save-person         {id?, first_name, last_name?, date_of_birth?, blood_type?, color, health_number?,
//                        allergies?, conditions?, notes?, emergency_contact?, user_id?}
//   remove-person       {id}
//   save-provider       {id?, name, kind, specialty?, phone?, email?, address?, website?, notes?}
//   delete-provider     {id}
//   save-appointment    {id?, person_id, provider_id?, title, kind, status, date?, time?, duration,
//                        location?, notes?, outcome?, remind_days, follow_up_of?}
//   appointment-status  {id, status, outcome?}
//   delete-appointment  {id}
//   save-medication     {id?, person_id, name, dose?, times[], instructions?, prescriber_id?, pharmacy_id?,
//                        start_date?, end_date?, refill_date?, active}
//   delete-medication   {id}
//   toggle-dose         {medication_id, date, time}     — a dose time "HH:MM" (as-needed: when it was given)
//   save-record         {id?, person_id, kind, title, date?, value?, notes?, provider_id?, next_due?}
//   delete-record       {id}

declare(strict_types=1);

use Src\Controller\MedicalsController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Medicals')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Medicals."]], 403);
}

$userId = (int) $userId;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_response(['success' => true] + MedicalsController::state());
    }

    if ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new MedicalsController();
        $id = (int) ($in['id'] ?? 0);

        $result = match ((string) ($in['action'] ?? '')) {
            'save-person'        => $c->savePerson($in, $userId),
            'remove-person'      => $c->removePerson($id),
            'save-provider'      => $c->saveProvider($in, $userId),
            'delete-provider'    => $c->deleteProvider($id),
            'save-appointment'   => $c->saveAppointment($in, $userId),
            'appointment-status' => $c->setAppointmentStatus($id, (string) ($in['status'] ?? ''), isset($in['outcome']) ? (string) $in['outcome'] : null),
            'delete-appointment' => $c->deleteAppointment($id),
            'save-medication'    => $c->saveMedication($in, $userId),
            'delete-medication'  => $c->deleteMedication($id),
            'toggle-dose'        => $c->toggleDose((int) ($in['medication_id'] ?? 0), (string) ($in['date'] ?? ''), (string) ($in['time'] ?? ''), $userId),
            'save-record'        => $c->saveRecord($in, $userId),
            'delete-record'      => $c->deleteRecord($id),
            default              => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}

<?php
declare(strict_types=1);
require __DIR__ . '/api/cors.php';
require __DIR__ . '/api/main_functions.php'; 
?>

<!DOCTYPE html>
<html lang="<?= htmlspecialchars($langCode, ENT_QUOTES, 'UTF-8') ?>">
<head>
    <meta charset="UTF-8">
    <title><?= t('app.title', 'NiBu-Photobooth') ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="src/favicon/favicon-96x96.png" sizes="96x96" />
<link rel="icon" type="image/svg+xml" href="src/favicon/favicon.svg" />
<link rel="shortcut icon" href="src/favicon/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="src/favicon/apple-touch-icon.png" />
<link rel="manifest" href="src/favicon/site.webmanifest" />

    <!-- Bootstrap CSS (CDN) – später ggf. lokal hosten -->
    <link
       rel="stylesheet" href="src/css/bootstrap.css" 
        rel="stylesheet"
    >
    <link rel="stylesheet" href="src/css/bootstrap-icons.css">

    <!-- Eigene Styles -->
    <link rel="stylesheet" href="src/css/main.css">
 
    
</head>
<body class="bg-dark text-light d-flex flex-column">

<?php
// Preloader
include __DIR__ . '/sections/preloader.php';

// Navbar / Header
include __DIR__ . '/sections/header.php';

include __DIR__ . '/sections/main.php';

//infomedlung rechts unten
include __DIR__ . '/sections/toast.php';

// Modals / Hauptbereiche
include __DIR__ . '/sections/general_settings.php';
include __DIR__ . '/sections/render_settings.php';
include __DIR__ . '/sections/printer_settings.php';
include __DIR__ . '/sections/cameraBrdige_setup.php';
include __DIR__ . '/sections/template_editor.php';
include __DIR__ . '/sections/active_event_settings.php';
include __DIR__ . '/sections/camera_settings.php';
include __DIR__ . '/sections/select_camera.php';
include __DIR__ . '/sections/unlock_screen.php';
include __DIR__ . '/sections/connection_info.php';
include __DIR__ . '/sections/capture_sections.php';



?>

<!-- Bootstrap Bundle (mit Popper) -->
<script
    src="src/js/bootstrap.bundle.min.js"
></script>

<!-- jQuery -->
<script src="src/js/jquery-3.7.1.min.js"></script>
<script src="src/js/crypto-js.min.js"></script>


<!-- Funktionssammlung (ohne Events) -->
<script src="src/js/functions/debug.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/debug_mode_bindings.js?v=<?php echo time(); ?>"></script>


<script src="src/js/functions/pb_core.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/config_io.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/app_bootstrap.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/camera_restore.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/main.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/edit_config.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/i18n.js?v=<?php echo time(); ?>"></script>
<!-- Einheitlicher JSON-Client für den lokalen API-Server -->
<script src="src/js/functions/bridge_api.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/pb_python_server.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/pb_bridge_services.js?v=<?php echo time(); ?>"></script>
<!-- Bridge UI + Device Selection (Dropdown, Refresh, Offline-Hint) -->
<script src="src/js/functions/camera_bridge.js?v=<?php echo time(); ?>"></script>
<!-- Preview (Webcam oder Kamera-IFrame) -->
<script src="src/js/functions/preview.js?v=<?php echo time(); ?>"></script>
<!-- Preview-Source List + Wrapper für refreshUnifiedDeviceDropdown -->
<script src="src/js/functions/select_device_bindings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/devices.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/main_screen.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/unlock.js?v=<?php echo time(); ?>"></script>
<!--<script src="src/js/functions/windows_api.js?v=<?php echo time(); ?>"></script>-->
<script src="src/js/functions/api_route.js?v=<?php echo time(); ?>"></script>
<!--<script src="src/js/functions/app_init.js?v=<?php //echo time(); ?>"></script>-->
<script src="src/js/functions/ui_fullscreen.js?v=<?php echo time(); ?>"></script>




<!-- Event-Handler / Initialisierung -->
<script src="src/js/app/preview_bindings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/modal_config_bindings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/fullscreen_unlock_bindings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/windows_picker_bindings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/printer_settings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/active_event.js?v=<?php echo time(); ?>"></script>
<!--<script src="src/js/app/app.js?v=<?php //echo time(); ?>"></script>-->
<script src="src/js/app/camerabridge_API_server_status.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/camerabridge_API_server_start_restart.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/icon_for_os.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/python_server_bindings.js?v=<?php echo time(); ?>"></script>


<!-- capture js -->
<script src="src/js/app/capture/capture_api.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/capture/capture_bindings.js?v=<?php echo time(); ?>"></script>
<script src="src/js/app/capture/capture_flow.js?v=<?php echo time(); ?>"></script>
<script src="src/js/functions/capture_test_photo.js?v=<?php echo time(); ?>"></script>


<script src="src/js/functions/pb-init.js?v=<?php echo time(); ?>"></script>
<!-- PRELOADER -->
<script src="src/js/functions/preloader.js?v=<?php echo time(); ?>"></script>

</body>
</html>

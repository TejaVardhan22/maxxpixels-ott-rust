-- +goose Up
-- 0013_cleanup_unused_system_settings.sql
-- Removes env-managed credentials (Bunny, Razorpay, Stripe, S3, MSG91, SMTP, FCM)
-- and unwired/removed Admin Settings keys (Currency, Feature Flags, Player, Device Limits, Games/APK)
-- from the system_settings table so DB stays aligned with the active Admin Settings tabs.

DELETE FROM system_settings
WHERE LOWER(REPLACE(COALESCE(setting_key, ''), '_', '')) IN (
    -- Storage / Bunny / S3 (managed via server .env)
    'storageprovider',
    'bunnystoragezonename',
    'bunnystoragezonepassword',
    'bunnystoragezone',
    'bunnystorageregion',
    'bunnystoragecdnurl',
    'bunnycdnhostname',
    'bunnypullzonedomain',
    'bunnystreamlibraryid',
    'bunnystreamapikey',
    'bunnystreamcdnhostname',
    's3masterbucket',
    's3streamingbucket',
    's3awsregion',
    's3endpointurl',
    's3accesskey',
    's3secretkey',
    'cdnbaseurl',

    -- Payments & Currency (managed via server .env / plans)
    'paymentgatewayprovider',
    'paymentactivegateway',
    'paymentprovider',
    'razorpaykeyid',
    'razorpaykeysecret',
    'razorpaywebhooksecret',
    'stripepublickey',
    'stripesecretkey',
    'defaultcurrency',
    'autoretryfailedrenewals',

    -- SMS / Email / Push (managed via server .env)
    'smsprovider',
    'msg91authkey',
    'msg91senderid',
    'msg91templateid',
    'smtphost',
    'smtpport',
    'smtpusername',
    'smtppassword',
    'smtpfromemail',
    'smtpfromname',
    'fcmpushserverkey',
    'fcmprojectid',

    -- Unwired AdMob / VAST fields
    'admobappid',
    'admobappopenid',
    'vastadtagurl',

    -- Unwired Feature Flags
    'featuredownloadsenabled',
    'featurewatchpartyenabled',
    'featurepipenabled',
    'featurecastingenabled',
    'featuretvloginenabled',
    'featurekidprofilesenabled',
    'featurerentalsenabled',
    'featuregamesenabled',

    -- Unwired Video Player settings
    'playerautoplay',
    'playerdefaultquality',
    'playerwatermarkenabled',
    'playerwatermarktext',

    -- Device Limits (enforced per Subscription Plan)
    'maxdevicesperuser',
    'maxconcurrentstreamsperuser',
    'allowscreenrecording',

    -- Unwired Games & APK settings
    'apklatestversioncode',
    'apklatestversionname',
    'apkdownloadurl',
    'androidlatestversion',

    -- Unrendered hidden branding keys
    'supporturl',
    'supportwhatsapp',
    'companyaddress',
    'defaulttimezone',
    'defaultlanguage',
    'defaultregion',
    'iosappurl'
);

-- +goose Down
-- Additive migration; down is intentionally a no-op to protect production data.
SELECT 1;

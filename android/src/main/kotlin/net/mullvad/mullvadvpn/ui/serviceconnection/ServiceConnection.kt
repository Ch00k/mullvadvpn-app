package net.mullvad.mullvadvpn.ui.serviceconnection

import android.os.Looper
import android.os.Messenger
import android.os.RemoteException
import android.util.Log
import net.mullvad.mullvadvpn.ipc.DispatchingHandler
import net.mullvad.mullvadvpn.ipc.Event
import net.mullvad.mullvadvpn.ipc.Request
import net.mullvad.mullvadvpn.service.ServiceInstance

class ServiceConnection(private val service: ServiceInstance) {
    val dispatcher = DispatchingHandler(Looper.getMainLooper()) { message ->
        Event.fromMessage(message)
    }

    val daemon = service.daemon
    val accountCache = AccountCache(service.messenger, dispatcher)
    val authTokenCache = AuthTokenCache(service.messenger, dispatcher)
    val connectionProxy = ConnectionProxy(service.messenger, dispatcher)
    val keyStatusListener = KeyStatusListener(service.messenger, dispatcher)
    val locationInfoCache = LocationInfoCache(dispatcher)
    val settingsListener = SettingsListener(service.messenger, dispatcher)
    val splitTunneling = SplitTunneling(service.messenger, dispatcher)

    val appVersionInfoCache = AppVersionInfoCache(dispatcher, settingsListener)
    val customDns = CustomDns(service.messenger, settingsListener)
    var relayListListener = RelayListListener(dispatcher, settingsListener)

    init {
        registerListener()
    }

    fun onDestroy() {
        dispatcher.onDestroy()

        accountCache.onDestroy()
        authTokenCache.onDestroy()
        connectionProxy.onDestroy()
        keyStatusListener.onDestroy()
        locationInfoCache.onDestroy()
        settingsListener.onDestroy()

        appVersionInfoCache.onDestroy()
        customDns.onDestroy()
        relayListListener.onDestroy()
    }

    private fun registerListener() {
        val listener = Messenger(dispatcher)
        val request = Request.RegisterListener(listener)

        try {
            service.messenger.send(request.message)
        } catch (exception: RemoteException) {
            Log.e("mullvad", "Failed to register listener for service events", exception)
        }
    }
}

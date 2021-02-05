package net.mullvad.mullvadvpn.ui.serviceconnection

import android.os.Looper
import android.os.Messenger
import android.os.RemoteException
import android.util.Log
import net.mullvad.mullvadvpn.dataproxy.AppVersionInfoCache
import net.mullvad.mullvadvpn.dataproxy.RelayListListener
import net.mullvad.mullvadvpn.ipc.DispatchingHandler
import net.mullvad.mullvadvpn.ipc.Event
import net.mullvad.mullvadvpn.ipc.Request
import net.mullvad.mullvadvpn.service.ServiceInstance
import net.mullvad.mullvadvpn.ui.MainActivity

class ServiceConnection(val service: ServiceInstance, val mainActivity: MainActivity) {
    val dispatcher = DispatchingHandler(Looper.getMainLooper()) { message ->
        Event.fromMessage(message)
    }

    val daemon = service.daemon
    val accountCache = AccountCache(service.messenger, dispatcher)
    val connectionProxy = ConnectionProxy(service.messenger, dispatcher)
    val customDns = service.customDns
    val keyStatusListener = KeyStatusListener(service.messenger, dispatcher)
    val locationInfoCache = LocationInfoCache(dispatcher)
    val settingsListener = SettingsListener(dispatcher)
    val splitTunneling = SplitTunneling(service.messenger, dispatcher)

    val appVersionInfoCache = AppVersionInfoCache(mainActivity, daemon, settingsListener)
    var relayListListener = RelayListListener(daemon, settingsListener)

    init {
        appVersionInfoCache.onCreate()
        service.connectionProxy.mainActivity = mainActivity
        registerListener()
    }

    fun onDestroy() {
        dispatcher.onDestroy()

        accountCache.onDestroy()
        connectionProxy.onDestroy()
        keyStatusListener.onDestroy()
        locationInfoCache.onDestroy()
        settingsListener.onDestroy()

        appVersionInfoCache.onDestroy()
        relayListListener.onDestroy()
        service.connectionProxy.mainActivity = null
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

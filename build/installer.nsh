!include "FileFunc.nsh"

!macro preInit
  !ifdef APP_64
    StrCpy $INSTDIR "$PROGRAMFILES64\Twine"
  !else
    StrCpy $INSTDIR "$PROGRAMFILES\Twine"
  !endif
!macroend

!macro customInit
  Push $R0
  Push $R1
  Push $R2

  ${GetFileName} "$INSTDIR" $R0
  StrCmp $R0 "frontend" 0 custom_done

  ${GetParent} "$INSTDIR" $R1
  ${GetFileName} "$R1" $R2
  StrCmp $R2 "Twine" 0 custom_done

  StrCpy $INSTDIR "$R1"

custom_done:
  Pop $R2
  Pop $R1
  Pop $R0
!macroend


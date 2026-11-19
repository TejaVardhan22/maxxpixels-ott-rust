import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private readonly darkSwal = Swal.mixin({
    background: '#1a1a24',
    color: '#ffffff',
    confirmButtonColor: '#e50914',
    cancelButtonColor: '#3a3a4c',
    customClass: {
      popup: 'ott-swal-popup',
      title: 'ott-swal-title',
      confirmButton: 'ott-swal-confirm-btn',
      cancelButton: 'ott-swal-cancel-btn'
    }
  });

  private readonly toastSwal = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    background: '#1a1a24',
    color: '#ffffff'
  });

  success(message: string, title = 'Success'): void {
    this.toastSwal.fire({
      icon: 'success',
      title: title,
      text: message
    });
  }

  error(message: string, title = 'Error'): void {
    this.toastSwal.fire({
      icon: 'error',
      title: title,
      text: message,
      timer: 5000
    });
  }

  warning(message: string, title = 'Warning'): void {
    this.toastSwal.fire({
      icon: 'warning',
      title: title,
      text: message
    });
  }

  info(message: string, title = 'Information'): void {
    this.toastSwal.fire({
      icon: 'info',
      title: title,
      text: message
    });
  }

  async confirm(title: string, text: string, confirmButtonText = 'Yes, Proceed', cancelButtonText = 'Cancel'): Promise<boolean> {
    const result: SweetAlertResult = await this.darkSwal.fire({
      icon: 'warning',
      title: title,
      text: text,
      showCancelButton: true,
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText,
      reverseButtons: true
    });
    return result.isConfirmed;
  }

  async prompt(title: string, inputLabel: string, placeholder = ''): Promise<string | null> {
    const result: SweetAlertResult = await this.darkSwal.fire({
      title: title,
      input: 'text',
      inputLabel: inputLabel,
      inputPlaceholder: placeholder,
      showCancelButton: true,
      confirmButtonText: 'Add New',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'This field cannot be empty!';
        }
        return null;
      }
    });
    if (result.isConfirmed && result.value) {
      return result.value.trim();
    }
    return null;
  }
}
